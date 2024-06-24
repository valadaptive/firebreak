import {Command, InvalidArgumentError, Option} from 'commander';

import {DependentPackage, fetchDependentPackages, fetchPopularPackages} from './ecosyste-ms.js';
import {DepGraph, resolvePackage, resolveTree} from './packages.js';

function parseIntArg(value: string) {
    const parsed = parseInt(value);
    if (!Number.isFinite(parsed)) {
        throw new InvalidArgumentError(`${value} is not a number`);
    }
    return parsed;
}

const now = Date.now();
function recencyParser(value: string) {
    const parsed = /([^a-z]+)([ywmd])/i.exec(value);
    if (!parsed) {
        throw new InvalidArgumentError('Failed to parse relative time');
    }
    const [, num, unit] = parsed;
    const n = Number(num);
    if (!Number.isFinite(n)) {
        throw new InvalidArgumentError('Failed to parse relative time');
    }
    const date = new Date(now);
    switch (unit) {
        case 'y':
            date.setUTCFullYear(date.getUTCFullYear() - n);
            break;
        case 'm':
            date.setUTCMonth(date.getUTCMonth() - n);
            break;
        case 'w':
            date.setUTCDate(date.getUTCDate() - (n * 7));
            break;
        case 'd':
            date.setUTCDate(date.getUTCDate() - n);
            break;
    }
    return date;
}

const program = new Command();

program.command('depsearch')
    .description('Search for a certain (possibly nested) dependency in a given package')
    .argument('<needle>', 'The dependency to search for (all versions will be searched for)')
    .argument('<haystack>', 'The package to search within, optionally with a given version')
    .action(async (needle: string, haystack: string) => {
        if (typeof needle !== 'string' || typeof haystack !== 'string') {
            throw new Error('Provide the package to search for as the first argument, and the package to search within as the second');
        }

        const haystackParts = /([^@]+)(?:@(.+))?/.exec(haystack);
        if (!haystackParts) {
            throw new Error(`Invalid package/version identifier: ${haystack}`);
        }
        const haystackName = haystackParts[1];
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        const haystackVersion = haystackParts[2] ?? 'latest';

        console.log('Resolving...');
        const tree = await resolveTree(haystackName, haystackVersion);
        console.log('Finding paths...');
        console.log(tree.findPathsTo(needle));
    });

program.command('popular-reverse-deps')
    .description('Search for the most popular reverse dependencies of a given package')
    .argument('<package>', 'The package to search the reverse dependencies of')
    .addOption(new Option(
        '--recent-update [PERIOD]',
        'Only show packages updated this recently (can be specified in "y"ears, "m"onths, "w"eeks, and "d"ays)',
    ).argParser(recencyParser))
    .addOption(new Option(
        '--downloads [THRESHOLD]',
        'Only show packages with at least this many downloads',
    ).argParser(parseIntArg))
    .addOption(new Option(
        '--max-results [MAXIMUM]',
        'Only show this many packages',
    ))
    .action(async (pkgName: string, options: {recentUpdate?: Date; downloads?: number; maxResults?: number}) => {
        let dependents = (await fetchDependentPackages(pkgName, options.maxResults));

        dependents = dependents.filter(pkg => {
            if (typeof options.downloads === 'number' && pkg.downloads && pkg.downloads < options.downloads) {
                return false;
            }

            if (
                options.recentUpdate &&
                pkg.latest_release_published_at &&
                Date.parse(pkg.latest_release_published_at) < options.recentUpdate.getTime()
            ) {
                return false;
            }

            return true;
        });

        if (dependents.length === 0) {
            console.log(`"${pkgName}" doesn't appear to have any popular reverse dependencies.`);
            console.log(`Note that the ecosyste.ms API doesn't seem to return accurate results,`);
            console.log(`so this may omit many packages.`);
            return;
        }

        console.log(`Fetched ${dependents.length} packages. Resolving dependencies...`);

        const realDependents: DependentPackage[] = [];
        await Promise.all(dependents.map(async (pkg) => {
            try {
                const resolved = await resolvePackage(pkg.name, 'latest');
                if (!resolved.manifest) return;
                const dependencyIsReal = resolved.manifest.dependencies &&
                    Object.prototype.hasOwnProperty.call(resolved.manifest.dependencies, pkgName);

                if (dependencyIsReal) realDependents.push(pkg);
            } catch (err) {
                console.warn(`Error fetching metadata for ${pkg.name}`);
            }
        }));

        console.log(realDependents);
    });

program.command('popular-packages-containing')
    .description('Search for popular packages depending on a given package')
    .argument('<package>', 'The package to search for')
    .addOption(new Option(
        '--recent-update [PERIOD]',
        'Only show packages updated this recently (can be specified in "y"ears, "m"onths, "w"eeks, and "d"ays)',
    ).argParser(recencyParser))
    .addOption(new Option(
        '--downloads [THRESHOLD]',
        'Only show packages with at least this many downloads',
    ).argParser(parseIntArg))
    .addOption(new Option(
        '--max-results [MAXIMUM]',
        'Only show this many packages',
    ))
    .action(async (pkgName: string, options: {recentUpdate?: Date; downloads?: number; maxResults?: number}) => {
        let packages = (await fetchPopularPackages(options.maxResults));

        packages = packages.filter(pkg => {
            if (typeof options.downloads === 'number' && pkg.downloads && pkg.downloads < options.downloads) {
                return false;
            }

            if (
                options.recentUpdate &&
                pkg.latest_release_published_at &&
                Date.parse(pkg.latest_release_published_at) < options.recentUpdate.getTime()
            ) {
                return false;
            }

            return true;
        });

        console.log(packages.length);

        const afflictedPackages: DepGraph[] = [];
        await Promise.all(packages.map(async (pkg) => {
            try {
                const resolved = await resolveTree(pkg.name, 'latest');
                if (resolved.depsByVersion.has(pkgName)) {
                    afflictedPackages.push(resolved);
                }
            } catch (err) {
                console.warn(`Error fetching metadata for ${pkg.name}`);
            }
        }));

        if (afflictedPackages.length === 0) {
            console.log(`"${pkgName}" doesn't appear to be contained in any popular packages.`);
            return;
        }

        for (const dep of afflictedPackages) {
            console.log(`${dep.rootManifest.name}:`);
            for (const path of dep.findPathsTo(pkgName)) {
                console.log(`    ${path.join(' -> ')}`);
            }
        }
    });

program.parse();
