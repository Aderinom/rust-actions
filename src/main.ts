import { info } from '@actions/core';
import { loadInput } from './input';
import { run } from './lib';

main();

async function main(): Promise<void> {
  const cfg = loadInput();
  info('Using configuration:' + JSON.stringify(cfg, null, 0));
  run(cfg);
}
