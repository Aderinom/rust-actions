import { spawnAsync } from './util';

main();

async function main(): Promise<void> {
  // List env
  await spawnAsync('Get-ChildItem', ['env:'], {
    shell: 'powershell.exe',
    stdio: 'inherit',
    env: process.env as any,
  });

  // const cfg = loadInput();
  // info('Using configuration:' + JSON.stringify(cfg, null, 0));
  // run(cfg);
}
