import { info } from '@actions/core';
import { loadInput } from './input.js';
import { run } from './lib.js';

main();

async function main(): Promise<void> {
  const cfg = loadInput();
  info('Using configuration:' + JSON.stringify(cfg, null, 0));
  run(cfg);
}
