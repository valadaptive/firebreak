import 'dotenv/config';
import {resolve} from 'node:path';

export type Config = {
    cacheDir: string;
};

export const config = {
    cacheDir: process.env.CACHE_DIR ?? resolve(import.meta.dirname, '..', '_cache'),
};
