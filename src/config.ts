import 'dotenv/config';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export type Config = {
    cacheDir: string;
};

export const config = {
    cacheDir: process.env.CACHE_DIR ?? resolve(dirname(fileURLToPath(import.meta.url)), '..', '_cache'),
};
