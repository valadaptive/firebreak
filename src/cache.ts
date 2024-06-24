import {join} from 'node:path';
import {config} from './config.js';

export function cacheDirFor(key: string) {
    return join(config.cacheDir, key);
}
