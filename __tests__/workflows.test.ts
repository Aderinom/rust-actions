import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { Cargo } from '../src/rust/cargo.js';
import {
  ClippyWorkflow,
  DenyWorkflow,
  DocsWorkflow,
  FlowConfig,
  FormatWorkflow,
  ShearWorkflow,
  TestWorkflow,
} from '../src/workflows.js';

const project = '/tmp/workflow-project';

const originalExec = Cargo.exec;

afterEach(() => {
  Cargo.exec = originalExec;
});

function stubCargoExec() {
  const calls: Array<{ args: string[]; options: { cwd: string } }> = [];

  Cargo.exec = async (args: string[], options?: { cwd?: string }) => {
    assert.ok(options?.cwd, 'expected cwd to be set');
    calls.push({ args, options: { cwd: options.cwd! } });
  };

  return calls;
}

function baseConfig<
  T extends 'test' | 'clippy' | 'fmt' | 'doc' | 'shear' | 'deny',
>(partial: Partial<FlowConfig<T>> = {}): FlowConfig<T> {
  return {
    project,
    cacheKey: undefined,
    ...partial,
  } as unknown as FlowConfig<T>;
}

describe('Workflow command construction', () => {
  test('TestWorkflow runs cargo test defaults', async () => {
    const calls = stubCargoExec();
    const wf = new TestWorkflow(baseConfig<'test'>({ failFast: true }));

    await wf.run();

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], {
      args: ['test', '--all', '--locked', '--all-targets', '--all-features'],
      options: { cwd: project },
    });
  });

  test('TestWorkflow adds --no-fail-fast when failFast=false', async () => {
    const calls = stubCargoExec();
    const wf = new TestWorkflow(baseConfig<'test'>({ failFast: false }));

    await wf.run();

    assert.deepEqual(calls[0].args, [
      'test',
      '--all',
      '--locked',
      '--all-targets',
      '--all-features',
      '--no-fail-fast',
    ]);
  });

  test('ClippyWorkflow adds toolchain and profile', async () => {
    const calls = stubCargoExec();
    const wf = new ClippyWorkflow(
      baseConfig<'clippy'>({ toolchain: 'nightly', buildProfile: 'ci' }),
    );

    await wf.run();

    assert.deepEqual(calls[0], {
      args: [
        '+nightly',
        'clippy',
        '--profile=ci',
        '--all',
        '--locked',
        '--all-targets',
        '--all-features',
      ],
      options: { cwd: project },
    });
  });

  test('ClippyWorkflow adds --deny warnings when configured', async () => {
    const calls = stubCargoExec();
    const wf = new ClippyWorkflow(baseConfig<'clippy'>({ denyWarnings: true }));

    await wf.run();

    assert.deepEqual(calls[0].args, [
      'clippy',
      '--all',
      '--locked',
      '--all-targets',
      '--all-features',
      `--`,
      `-D`,
      'warnings',
    ]);
  });

  test('FormatWorkflow runs expected fmt check command', async () => {
    const calls = stubCargoExec();
    const wf = new FormatWorkflow(baseConfig<'fmt'>());

    await wf.run();

    assert.deepEqual(calls[0], {
      args: ['fmt', '--all', '--', '--check'],
      options: { cwd: project },
    });
  });

  test('DocsWorkflow uses profile and no-deps defaults', async () => {
    const calls = stubCargoExec();
    const wf = new DocsWorkflow(baseConfig<'doc'>({ buildProfile: 'release' }));

    await wf.run();

    assert.deepEqual(calls[0], {
      args: ['doc', '--profile=release', '--all', '--locked', '--no-deps'],
      options: { cwd: project },
    });
  });

  test('ShearWorkflow uses override args when provided', async () => {
    const calls = stubCargoExec();
    const wf = new ShearWorkflow(
      baseConfig<'shear'>({ overrideArgs: ['--workspace', '--fix'] }),
    );

    await wf.run();

    assert.deepEqual(calls[0], {
      args: ['shear', '--workspace', '--fix'],
      options: { cwd: project },
    });
  });

  test('DenyWorkflow prepends toolchain and uses default check arg', async () => {
    const calls = stubCargoExec();
    const wf = new DenyWorkflow(baseConfig<'deny'>({ toolchain: 'stable' }));

    await wf.run();

    assert.deepEqual(calls[0], {
      args: ['+stable', 'deny', 'check'],
      options: { cwd: project },
    });
  });
});
