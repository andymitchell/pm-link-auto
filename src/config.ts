// src/config.ts

import { cosmiconfig } from 'cosmiconfig';
import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import * as recast from 'recast';
import * as babelParser from '@babel/parser';
import type { LinkerConfig, LoadedConfig } from './types.ts';

export const MODULE_NAME = 'pm-link-auto';


export async function loadConfig(): Promise<LoadedConfig | null> {
    const explorer = cosmiconfig(MODULE_NAME, {
        searchPlaces: [`${MODULE_NAME}.config.ts`, `${MODULE_NAME}.config.js`],
        // Note: cosmiconfig needs a loader for .ts files. 
        // If running in a project with ts-node or similar, this works.
        // For a standalone binary, ensuring TS support might need more config.
    });

    const result = await explorer.search();

    if (!result) {
        console.error(chalk.red(`Could not find a configuration file for ${MODULE_NAME}.`));
        console.log(
            chalk.yellow(`Please create a \`${MODULE_NAME}.config.ts\` (or .js) file in your project root. See documentation for details.`),
        );
        return null;
    }

    console.log(chalk.blue(`✓ Using configuration file: ${path.relative(process.cwd(), result.filepath)}`));
    return {
        config: result.config as LinkerConfig,
        filepath: result.filepath,
    };
}


/**
 * Updates a package's path in the given .ts or .js configuration file
 * using an AST parser to preserve formatting.
 */
export async function updateConfigFile(filepath: string, packageName: string, newPath: string): Promise<void> {
    try {
        const relativePath = newPath;//path.relative(path.dirname(filepath), newPath).replace(/\\/g, '/');
        const content = await fs.readFile(filepath, 'utf-8');

        console.log({content})
        // Parse the code into an AST, preserving its structure.
        // We use the babel/parser because it handles TS syntax out of the box.
        const ast = recast.parse(content, {
            parser: {
                parse: (source: string) => babelParser.parse(source, {
                    sourceType: 'module',
                    plugins: ['typescript'],
                }),
            },
        });

        let updated = false;

        // Visit every node in the AST.
        recast.visit(ast, {
            // We are interested in object literals: { ... }
            visitObjectExpression(nodePath) {
                // Check if this object has a `name` property matching our package.
                console.log(nodePath.node.properties)
                const nameProperty = nodePath.node.properties.find(
                    (p): p is recast.types.namedTypes.Property =>
                        p.type === 'ObjectProperty' &&
                        p.key.type === 'Identifier' &&
                        p.key.name === 'name' &&
                        p.value.type === 'StringLiteral' &&
                        p.value.value === packageName
                );
                

                if (!nameProperty) {
                    // This is not the package object we're looking for, continue traversing.
                    return this.traverse(nodePath);
                }

                // We found the right package object! Now find its `path` property.
                const pathProperty = nodePath.node.properties.find(
                    (p): p is recast.types.namedTypes.Property =>
                        p.type === 'ObjectProperty' && p.key.type === 'Identifier' && p.key.name === 'path'
                );

                const b = recast.types.builders;

                if (pathProperty) {
                    // Path property exists, so update its value.
                    pathProperty.value = b.stringLiteral(relativePath);
                } else {
                    // Path property does not exist, so add it after the `name` property.
                    const newPathProperty = b.property('init', b.identifier('path'), b.stringLiteral(relativePath));
                    const nameIndex = nodePath.node.properties.indexOf(nameProperty);
                    nodePath.node.properties.splice(nameIndex + 1, 0, newPathProperty);
                }
                
                updated = true;
                // We're done, no need to visit children of this node.
                return false;
            },
        });

        if (updated) {
            // Print the modified AST back to a string, preserving formatting.
            const newContent = recast.print(ast, { tabWidth: 2, quote: 'single' }).code;
            await fs.writeFile(filepath, newContent, 'utf-8');
            console.log(chalk.yellow(`Updated ${path.basename(filepath)}: '${packageName}' path set to '${relativePath}'`));
        } else {
            console.warn(chalk.yellow(`Could not find an entry for '${packageName}' in the config file to update.`));
        }

    } catch (error) {
        console.error(chalk.red.bold(`\nFailed to parse or update configuration file at ${filepath}.`), error);
    }
}