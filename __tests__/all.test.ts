import { which } from '@actions/io';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { Input, loadInput } from '../src/input.js';
import { addCargoToPath, run } from '../src/lib.js';
import { workflowConfig } from '../src/workflows.js';

addCargoToPath();

const project_dir = __dirname + '/test-cargo-repo';
describe('Workflows', () => {
  test(`should create correct workflow config`, async () => {
    const options = {
      project: project_dir,
      run: ['test', 'clippy'],
      cacheKey: 'no-cache',
      toolchain: 'stable',
      profile: 'ci',
      flow: {
        clippy: {
          toolchain: 'nightly',
          denyWarnings: true,
        },
        test: {},
      },
    } as Input;

    const config1 = workflowConfig(options, 'test');
    assert.deepStrictEqual(config1, {
      project: project_dir,
      buildProfile: 'ci',
      toolchain: 'stable',
      cacheKey: undefined,
      overrideArgs: undefined,
    });

    const config2 = workflowConfig(options, 'clippy');
    assert.deepEqual(config2, {
      project: project_dir,
      buildProfile: 'ci',
      toolchain: 'nightly',
      cacheKey: undefined,
      overrideArgs: undefined,
      denyWarnings: true,
    });
  });

  const config = loadInput();
  for (const wf of Object.keys(config.flow)) {
    test(`should succeed for ${wf}`, { timeout: 45_000 }, async () => {
      const options = structuredClone(config);
      options.project = project_dir;
      options.run = [wf];
      options.cacheKey = 'no-cache';
      options.flow.clippy.toolchain = 'nightly';
      options.profile = 'ci';

      const result = await run(options);
      assert.equal(result.succeeded, true);
      console.log(result);
    });
  }
});

describe(`Additional Tools Installation`, () => {
  test(`should install additional tools`, async () => {
    const options = loadInput();
    options.project = project_dir;
    options.run = [];
    options.cacheKey = 'no-cache';
    options.installOnly = true;
    options.installAdditional = ['cargo-audit@0.17.4', 'cargo-sbom'];

    const result = await run(options);

    console.log(result);

    // check that the tools are installed
    await which('cargo-audit', true);
    await which('cargo-sbom', true);

    // check that the installed tools are reported
    assert.deepStrictEqual(result.installedTools, [
      ['cargo-audit', '0.17.4'],
      ['cargo-sbom', 'latest'],
    ]);

    // no workflows should have run
    assert.deepStrictEqual(result.workflowResults, {});

    assert.equal(result.succeeded, true);
  });
});

describe(`Additional Component Installation`, () => {
  test(`should install additional components`, async () => {
    const options = loadInput();
    options.project = project_dir;
    options.run = [];
    options.cacheKey = 'no-cache';
    options.installOnly = true;
    options.extraComponents = ['rust-src', 'rustfmt'];

    const result = await run(options);

    console.log(result);
  });
});
