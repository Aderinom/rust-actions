import { info } from 'node:console';
import parseArgsStringToArgv from 'string-argv';
import { Cargo } from './cargo';
import { Input } from './input';

// Definition of a workflow
export interface Workflow {
  readonly name: string;
  readonly run: () => Promise<void>;
  // List of required tools as [tool, version] tuples to ensure before running
  readonly requiredTools: [string, string][];
  readonly config: FlowConfig<any>;
}

export class TestWorkflow implements Workflow {
  readonly name = 'test';
  readonly requiredTools: [string, string][] = [];

  constructor(readonly config: FlowConfig<'test'>) {}

  async run(): Promise<void> {
    const args = ['--all', '--locked', '--all-targets', '--all-features'];

    if (!this.config.failFast) {
      args.push('--no-fail-fast');
    }

    const cmd = cargoCommand('test', this.config, args, true);
    info(
      `Executing command: cargo ${cmd.join(' ')}, in directory: ${this.config.project}`,
    );
    await Cargo.exec(cmd, { cwd: this.config.project });
  }
}

export class ClippyWorkflow implements Workflow {
  readonly name = 'clippy';
  readonly requiredTools: [string, string][] = [];

  constructor(readonly config: FlowConfig<'clippy'>) {}

  async run(): Promise<void> {
    const cmd = cargoCommand(
      'clippy',
      this.config,
      ['--all', '--locked', '--all-targets', '--all-features'],
      true,
    );
    info(
      `Executing command: cargo ${cmd.join(' ')}, in directory: ${this.config.project}`,
    );
    await Cargo.exec(cmd, { cwd: this.config.project });
  }
}

export class FormatWorkflow implements Workflow {
  readonly name = 'fmt';
  readonly requiredTools: [string, string][] = [];

  constructor(readonly config: FlowConfig<'fmt'>) {}

  async run(): Promise<void> {
    const cmd = cargoCommand(
      'fmt',
      this.config,
      ['--all', '--', '--check'],
      false,
    );
    info(
      `Executing command: cargo ${cmd.join(' ')}, in directory: ${this.config.project}`,
    );
    await Cargo.exec(cmd, { cwd: this.config.project });
  }
}

export class DocsWorkflow implements Workflow {
  readonly name = 'doc';
  readonly requiredTools: [string, string][] = [];

  constructor(readonly config: FlowConfig<'doc'>) {}

  async run(): Promise<void> {
    const cmd = cargoCommand(
      'doc',
      this.config,
      ['--all', '--locked', '--no-deps'],
      true,
    );
    info(
      `Executing command: cargo ${cmd.join(' ')}, in directory: ${this.config.project}`,
    );
    await Cargo.exec(cmd, { cwd: this.config.project });
  }
}

export class ShearWorkflow implements Workflow {
  readonly name = 'shear';
  readonly requiredTools: [string, string][] = [['cargo-shear', 'latest']];

  constructor(readonly config: FlowConfig<'shear'>) {}

  async run(): Promise<void> {
    const cmd = cargoCommand('shear', this.config, [], false);
    info(
      `Executing command: cargo ${cmd.join(' ')}, in directory: ${this.config.project}`,
    );
    await Cargo.exec(cmd, { cwd: this.config.project });
  }
}

export class DenyWorkflow implements Workflow {
  readonly name = 'deny';
  readonly requiredTools: [string, string][] = [['cargo-deny', 'latest']];

  constructor(readonly config: FlowConfig<'deny'>) {}

  async run(): Promise<void> {
    const cmd = cargoCommand('deny', this.config, ['check'], false);
    info(
      `Executing command: 'cargo ${cmd.join(' ')}', in directory: ${this.config.project}`,
    );
    await Cargo.exec(cmd, {
      cwd: this.config.project,
    });
  }
}

// Helper to build cargo command with toolchain and flags
function cargoCommand(
  command: string,
  config: FlowConfig<any>,
  args: string[],
  addProfile: boolean,
): string[] {
  const cargoCommand = [] as string[];
  if (config.toolchain) {
    cargoCommand.push(`+${config.toolchain}`);
  }

  if (addProfile && config.buildProfile) {
    args.unshift(`--profile=${config.buildProfile}`);
  }

  cargoCommand.push(command);

  if (config.overrideArgs) {
    cargoCommand.push(...config.overrideArgs);
  } else {
    cargoCommand.push(...args);
  }

  return cargoCommand;
}

export type FlowConfig<T extends keyof Input['flow']> = Omit<
  Input['flow'][T],
  'overrideArgs'
> & {
  project: string;
  cacheKey: string;
  buildProfile?: string;
  toolchain?: string;
  overrideArgs?: string[];
};
// Helper to build workflow config by merging base config with specific flow config
export function workflowConfig<T extends keyof Input['flow']>(
  cfg: Input,
  flow: T,
): FlowConfig<T> {
  let cacheKey: String | undefined = undefined;

  // Set to default cache key unless 'no-cache' is specified
  if (cfg.cacheKey !== 'no-cache') {
    cacheKey = cfg.cacheKey;
  }

  const flowConfig = structuredClone(cfg.flow[flow]) as any;
  const overrideArgs =
    typeof flowConfig.overrideArgs === 'string'
      ? parseArgsStringToArgv(flowConfig.overrideArgs)
      : undefined;

  const finalConfig = {
    ...flowConfig,
    project: cfg.project,
    toolchain: flowConfig.toolchain ?? cfg.toolchain, // Flow-specific toolchain overrides global
    buildProfile: cfg.profile,
    cacheKey,
    overrideArgs,
  };

  return finalConfig;
}
