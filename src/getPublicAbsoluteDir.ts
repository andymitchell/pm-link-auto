import path from "path";
import { fileURLToPath } from "url";


/**
 * Works in both dev and production to get a path to non-compiled files (e.g. templates).
 * 
 * This must sit in the ./src root. 
 * 
 * The key to making this work is to keep files aligned: 
 * dev:
 *  - ./src/getPublicDir.ts
 *  - ./public/templates
 * production: 
 *  - ./dist/index.js (where getPublicDir is transpiled)
 *  - ./public/templates
 * 
 * In both cases, it's one folder up (src/dist) to the root, and into templates. 
 * 
 * To copy templates: 
 * - In package.json's scripts, use {scripts: {build: "your-exisitng-build && cp -a 'public' 'dist/public'"}} 
 * 
 * @param dir 
 */
export function getPublicAbsoluteDir<T extends string = 'templates'>(publicSubDir: T):string {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));

    // Take it to the public dir via the root, relative to this (because we're in ./src, it's ../)
    const publicDir = path.join(currentDir, '../public'); 

    return path.join(publicDir, `./${publicSubDir}`);

}