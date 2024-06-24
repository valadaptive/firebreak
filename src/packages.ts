import {createFetchFromRegistry} from '@pnpm/fetch';
import {createResolver} from '@pnpm/default-resolver';
import {DependencyManifest} from '@pnpm/types';

import {cacheDirFor} from './cache.js';
import {Graph} from './graph.js';

const fetchFromRegistry = createFetchFromRegistry({});
const resolver = createResolver(fetchFromRegistry, () => undefined, {
    cacheDir: cacheDirFor('pnpm'),
});

export function resolvePackage(name: string, version: string) {
    return resolver.resolve(
        {alias: name, pref: version},
        {projectDir: '', lockfileDir: '', preferredVersions: {}, registry: 'https://registry.npmjs.org/'},
    );
}

export async function resolveTree(name: string, version: string) {
    const graph = new Graph<string>();
    const packages = new Map<string, DependencyManifest>();
    const graphPromises: Promise<unknown>[] = [];
    const promises = new Map<string, Promise<string>>();
    const allDepsByVersion = new Map<string, Set<string>>();

    function resolveOne(name: string, version: string): Promise<string> {
        const promiseID = `${name}_${version}`;
        const existing = promises.get(promiseID);
        if (existing) return existing;

        const promise = (async () => {
            const {id, manifest} = await resolvePackage(name, version);
            if (!manifest) {
                console.warn(`No manifest for ${id}`);
                return id;
            }

            if (packages.has(id)) return id;

            packages.set(id, manifest);

            const resolvedDepPromises: Promise<string>[] = [];
            if (manifest.dependencies) {
                for (const [name, version] of Object.entries(manifest.dependencies)) {
                    resolvedDepPromises.push(resolveOne(name, version));
                }
            }

            graphPromises.push(Promise.all(resolvedDepPromises).then(deps => {
                for (const dep of deps) {
                    graph.connect(id, dep);
                }
            }));

            let depsByVersion = allDepsByVersion.get(name);
            if (!depsByVersion) {
                depsByVersion = new Set();
                allDepsByVersion.set(name, depsByVersion);
            }
            depsByVersion.add(manifest.version);

            return id;
        })();

        promises.set(promiseID, promise);
        return promise;
    }

    const rootId = resolveOne(name, version);
    await Promise.all(promises.values());
    while (graphPromises.length > 0) {
        await graphPromises.pop();
    }
    return new DepGraph(graph, packages, await rootId, allDepsByVersion);
}

export class DepGraph {
    graph;
    packages;
    root;
    depsByVersion;

    constructor(
        graph: Graph<string>,
        packages: Map<string, DependencyManifest>,
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
}
