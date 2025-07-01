#!/usr/bin/env node

import chalk from 'chalk';
import { loadConfig } from './config.ts';
import { runLinker } from './linker.ts';
import { detectPackageManager } from './utils.ts';

async function main() {
  const loadedConfig = await loadConfig();
  if (!loadedConfig) {
    process.exit(1);
  }
  
  const pm = detectPackageManager();
  console.log(chalk.blue(`✓ Detected package manager: ${pm}`));
  
  await runLinker(loadedConfig.config, loadedConfig.filepath, pm);
}

main().catch(err => {
  console.error(chalk.red.bold('\nAn unexpected error occurred:'));
  console.error(err);
  process.exit(1);
});