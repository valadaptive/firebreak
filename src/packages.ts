import {createFetchFromRegistry} from '@pnpm/fetch';
import {createResolver} from '@pnpm/default-resolver';
import {DependencyManifest} from '@pnpm/types';

import {cacheDirFor} from './cache.js';
import {Graph} from './graph.js';

const fetchFromRegistry = createFetchFromRegistry({fullMetadata: true});
const resolver = createResolver(fetchFromRegistry, () => undefined, {
    cacheDir: cacheDirFor('pnpm'),
    //fullMetadata: true,
});

export function resolvePackage(name: string, version: string) {
    return resolver.resolve(
        {alias: name, pref: version},
        {projectDir: '', lockfileDir: '', preferredVersions: {}, registry: 'https://registry.npmjs.org/'},
    );
}

export type Maintainer = string | {name?: string; email?: string; url?: string};
export type ResolvedManifest = Omit<DependencyManifest, 'author'> & {
    resolvedDependencies: Record<string, ResolvedManifest>;
    id: string;
    maintainers?: Maintainer[];
    author?: Maintainer;
};

export async function resolveTree(name: string, version: string) {
    const graph = new Graph<string>();
    const packages = new Map<string, ResolvedManifest>();
    const graphPromises: Promise<unknown>[] = [];
    const promises = new Map<string, Promise<{id: string; manifest: ResolvedManifest | null}>>();
    const allDepsByVersion = new Map<string, Set<string>>();

    function resolveOne(name: string, version: string): Promise<{id: string; manifest: ResolvedManifest | null}> {
        const promiseID = `${name}_${version}`;
        const existing = promises.get(promiseID);
        if (existing) return existing;

        const promise = (async () => {
            const {id, manifest} = await resolvePackage(name, version);
            if (!manifest) {
                console.warn(`No manifest for ${id}`);
                return {id, manifest: null};
            }

            const existingPackage = packages.get(id);
            if (existingPackage) return {id, manifest: existingPackage};


            const resolvedDepPromises: Promise<{id: string; manifest: ResolvedManifest | null}>[] = [];
            const resolvedDependencies: Record<string, ResolvedManifest> = {};
            if (manifest.dependencies) {
                for (const [name, version] of Object.entries(manifest.dependencies)) {
                    resolvedDepPromises.push(resolveOne(name, version));
                }
            }

            const resolvedManifest = Object.assign(manifest, {resolvedDependencies, id});
            packages.set(id, resolvedManifest);

            graphPromises.push(Promise.all(resolvedDepPromises).then(deps => {
                for (const dep of deps) {
                    if (dep.manifest) resolvedDependencies[dep.id] = dep.manifest;
                    graph.connect(id, dep.id);
                }
            }));

            let depsByVersion = allDepsByVersion.get(name);
            if (!depsByVersion) {
                depsByVersion = new Set();
                allDepsByVersion.set(name, depsByVersion);
            }
            depsByVersion.add(manifest.version);

            return {id, manifest: resolvedManifest};
        })();

        promises.set(promiseID, promise);
        return promise;
    }

    const rootDep = resolveOne(name, version);
    await Promise.all(promises.values());
    while (graphPromises.length > 0) {
        await graphPromises.pop();
    }
    return new DepGraph(graph, packages, (await rootDep).id, allDepsByVersion);
}

export class DepGraph {
    graph;
    packages;
    root;
    depsByVersion;

    constructor(
        graph: Graph<string>,
        packages: Map<string, ResolvedManifest>,
        root: string,
        depsByVersion: Map<string, Set<string>>,
    ) {
        this.graph = graph;
        this.packages = packages;
        this.root = root;
        this.depsByVersion = depsByVersion;
    }

    get rootManifest() {
        return this.packages.get(this.root)!;
    }

    toString() {
        const output = [];
        const stack: [string, number, string[]][] = [[this.root, 0, [this.root]]];
        const visitedCount = new Map<string, number>();
        const MAX_VISITS = 5;

        let currentNode;
        while (typeof (currentNode = stack.pop()) !== 'undefined') {
            const [node, indent, path] = currentNode;
            const nodeVisitedCount = visitedCount.get(node) ?? 0;
            let printedPath = '  '.repeat(indent) + node;
            const outgoing = this.graph.outgoing(node);
            if (nodeVisitedCount >= MAX_VISITS) {
                if (outgoing.size > 0) {
                    printedPath += ` [already printed ${MAX_VISITS} times]`;
                }
                output.push(printedPath);
                continue;
            }
            visitedCount.set(node, nodeVisitedCount + 1);

            output.push(printedPath);
            for (const child of outgoing) {
                if (path.includes(child)) {
                    output.push('  '.repeat(indent + 1) + `${child} [cyclic]`);
                    continue;
                }

                stack.push([child, indent + 1, [...path, child]]);
            }
        }

        return output.join('\n');
    }

    findPathsTo(packageName: string) {
        const destNodes = [];
        for (const [id, pkg] of this.packages) {
            if (pkg.name === packageName) {
                destNodes.push(id);
            }
        }

        const paths: string[][] = [];
        const visited = new Set();
        const traverseBack = (node: string, path: string[]) => {
            if (node === this.root) {
                paths.push(path.reverse());
                return;
            }

            for (const dependent of this.graph.incoming(node)) {
                if (path.includes(dependent)) continue;
                const appendedPath = path.slice(0);
                appendedPath.push(dependent);
                traverseBack(dependent, appendedPath);
            }
        };
        for (const dest of destNodes) {
            visited.clear();
            traverseBack(dest, [dest]);
        }
        return paths;
    }

    traverseDeps(cb: (dep: ResolvedManifest, path: string[]) => boolean) {
        const stack: {id: string; path: string[]}[] = [{id: this.root, path: [this.root]}];

        let node;
        while ((node = stack.pop())) {
            const {id, path} = node;
            const pkg = this.packages.get(id)!;
            if (cb(pkg, path)) {
                for (const dep of Object.values(pkg.resolvedDependencies)) {
                    if (!path.includes(dep.id)) {
                        stack.push({id: dep.id, path: [...path, dep.id]});
                    }
                }
            }
        }
    }
}
