import {
    getRegistryPackageDependentPackagesResponse,
    getRegistryPackageDependentPackagesResponseItem,
    getRegistryPackagesResponse,
    getRegistryPackagesResponseItem,
} from './gen/zod/ecosysteMsPackages.js';
import {mkdir} from 'node:fs/promises';
import {stringify} from 'node:querystring';
import Keyv from 'keyv';

import {config} from './config.js';
import {z} from 'zod';

let cache: Keyv | undefined;

async function getCache() {
    if (!cache) {
        await mkdir(config.cacheDir, {recursive: true});
        cache = new Keyv(`sqlite://${config.cacheDir}/ecosyste-ms.sqlite`);
    }
    return cache;
}

export async function fetchDependentPackages(packageName: string, maxResults = 1000) {
    const cache = await getCache();

    const queryString = stringify({
        page: 0,
        per_page: maxResults,
        sort: 'downloads',
        order: 'desc',
        latest: 'true',
    });
    const url = `https://packages.ecosyste.ms/api/v1/registries/npmjs.org/packages/${packageName}/dependent_packages?${queryString}`;

    let response = await cache.get(url) as unknown;
    if (!response) {
        response = await fetch(url, {
            headers: {
                accept: 'application/json',
            },
        }).then(resp => resp.json()) as unknown;
        await cache.set(url, response, 3 * 60 * 60 * 1000);
    }

    return getRegistryPackageDependentPackagesResponse.parse(response);
}

export async function fetchPopularPackages(maxResults = 1000) {
    const cache = await getCache();

    const queryString = stringify({
        page: 0,
        per_page: maxResults,
        sort: 'downloads',
        order: 'desc',
    });
    const url = `https://packages.ecosyste.ms/api/v1/registries/npmjs.org/packages?${queryString}`;

    let response = await cache.get(url) as unknown;
    if (!response) {
        response = await fetch(url, {
            headers: {
                accept: 'application/json',
            },
        }).then(resp => resp.json()) as unknown;
        await cache.set(url, response, 3 * 60 * 60 * 1000);
    }

    return getRegistryPackagesResponse.parse(response);
}

export type DependentPackage = z.infer<typeof getRegistryPackageDependentPackagesResponseItem>;
export type RegistryPackage = z.infer<typeof getRegistryPackagesResponseItem>;
