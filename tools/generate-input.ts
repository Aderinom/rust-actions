// Automatically generate the input interface and action.yml from the definition object below.

import { writeFileSync } from 'fs';

const actionInfo = {
  title: 'Rust All Action',
  description: `Simple GitHub Action to cache (toolchains and tools) and run multiple Rust workflows.`,
  branding: {
    icon: 'check-circle',
    color: 'orange',
  },
};

const definition: Definition = {
  project: {
    type: 'string',
    description: 'Path to the Rust project',
    default: '.',
  },
  profile: {
    type: 'string',
    description: 'Cargo build profile to use',
  },
  run: {
    type: 'string[]',
    description: 'Workflows to run',
    default: 'all-default',
  },
  cacheKey: {
    type: 'string',
    description: 'Cache key for dependencies',
    default: 'rax-cache',
  },
  toolchain: {
    type: 'string',
    description: 'Rust toolchain to use',
  },
  extraComponents: {
    type: 'string[]',
    description: 'Additional toolchain components to install e.g. rust-src',
  },
  installOnly: {
    type: 'boolean',
    description:
      'If true, only install the toolchain and tools without running any workflows',
  },
  installAdditional: {
    type: 'string[]',
    description:
      'Additional cargo tools to install and cache e.g. cargo-audit@0.17.4, cargo-toolX@version',
  },
  buildCacheStrategy: {
    type: 'string',
    description: '"github" to enable build caching through GitHub Cache',
    default: 'none',
  },
  buildCacheFallbackBranch: {
    type: 'string',
    description:
      'Fallback branch to use for build cache if the current branch has no cache',
    default: 'main',
  },
  flow: {
    test: {
      toolchain: {
        type: 'string',
        description: 'Toolchain for test workflow',
      },
      overrideArgs: {
        type: 'string',
        description: 'Override arguments for test workflow',
      },
      failFast: {
        type: 'boolean',
        description: 'If true, tests stop on first failure',
        default: 'false',
      },
    },
    clippy: {
      toolchain: {
        type: 'string',
        description: 'Toolchain for clippy workflow',
      },
      overrideArgs: {
        type: 'string',
        description: 'Override arguments for clippy workflow',
      },
      denyWarnings: {
        type: 'boolean',
        description: 'Deny warnings in clippy workflow',
        default: 'true',
      },
    },
    fmt: {
      toolchain: {
        type: 'string',
        description: 'Toolchain for fmt workflow',
      },
      overrideArgs: {
        type: 'string',
        description: 'Override arguments for fmt workflow',
      },
    },
    doc: {
      toolchain: {
        type: 'string',
        description: 'Toolchain for doc workflow',
      },
      overrideArgs: {
        type: 'string',
        description: 'Override arguments for doc workflow',
      },
      denyWarnings: {
        type: 'boolean',
        description: 'Deny warnings in doc workflow',
        default: 'true',
      },
    },
    shear: {
      toolchain: {
        type: 'string',
        description: 'Toolchain for shear workflow',
      },
      overrideArgs: {
        type: 'string',
        description: 'Override arguments for shear workflow',
      },
    },
    deny: {
      toolchain: {
        type: 'string',
        description: 'Toolchain for deny workflow',
      },
      overrideArgs: {
        type: 'string',
        description: 'Override arguments for deny workflow',
      },
    },
  },
};

interface InputDefinition {
  type: 'string' | 'string[]' | 'boolean';
  default?: string;
  required?: boolean;
  description?: string;
}
function isInput(obj: any): obj is InputDefinition {
  return obj && typeof obj === 'object' && 'type' in obj;
}

type Definition = InputDefinition | { [key: string]: Definition };

function generateInputInterface(definition: Definition): string {
  function renderDoc(def: InputDefinition): string {
    const parts: string[] = [];
    if (def.description) {
      parts.push(def.description);
    }
    if (def.default !== undefined) {
      parts.push(`(default: ${JSON.stringify(def.default)})`);
    }

    return parts.join(' ');
  }

  function renderMember(def: InputDefinition, key: string): string {
    const type = def.type as string;
    const optional =
      def.required === false || def.default === undefined ? '?' : '';

    const doc = renderDoc(def);
    return `//${doc}\n${key}${optional}: ${type};`;
  }

  function renderRecurse(def: Definition): string {
    // Leaf input definition
    if (isInput(def)) {
      return def.type as string;
    }
    const lines: string[] = ['{'];

    // Nested object
    for (const [key, value] of Object.entries(def)) {
      if (isInput(value)) {
        lines.push(renderMember(value, key));
      } else {
        // Recurse into nested object
        lines.push(`${key}: ${renderRecurse(value)};`);
      }
    }
    lines.push('}');
    return lines.join('\n');
  }

  const body = renderRecurse(definition);
  return `export interface Input ${body};`;
}

function generateLoadFunction(definition: Definition): string {
  function renderLoad(def: Definition, path: string[]): string {
    if (isInput(def)) {
      const lines: string[] = [];
      lines.push(`{`);
      const keyPath = path.map((p) => `['${p}']`).join('');
      const type = def.type;

      const inputName = path.join('-');
      // Read input value
      lines.push(`let strvalue = core.getInput('${inputName}');`);
      lines.push(`let value = strvalue.length > 0 ? strvalue : undefined;`);
      // Handle default value
      if (def.default !== undefined) {
        lines.push(
          `if (value === undefined) { value = ${JSON.stringify(def.default)}; }`,
        );
      }

      // Handle expected required input
      if (def.required) {
        lines.push(
          `if (value === undefined) { throw new Error('Input "${inputName}" is required but not provided.'); }`,
        );
      }

      lines.push(`if (value !== undefined) {`);
      let parse;
      if (type === 'string[]') {
        parse = `value.split(',').map((s) => s.trim()).filter((s) => s.length > 0)`;
      } else if (type === 'boolean') {
        parse = `value.trim().toLowerCase() === 'true' ? true : value.trim().toLowerCase() === 'false' ? false : (() => { throw new Error('Input "${inputName}" must be a boolean (true/false)'); })()`;
      } else {
        parse = `value.trim().length > 0 ? value.trim() : (() => { throw new Error('Input "${inputName}" must be a non-empty string'); })()`;
      }

      lines.push(`cfg${keyPath} = ${parse} as any;`);
      lines.push(`} else {`);
      lines.push(`cfg${keyPath} = undefined;`);
      lines.push(`}`);
      lines.push(`}`);

      return lines.join('\n');
    } else {
      const lines: string[] = [];
      // Create nested object
      if (path.length !== 0) {
        const keyPath = path.map((p) => `['${p}']`).join('');
        lines.push(`cfg${keyPath} = {};`);
      }

      // Recurse into nested object
      for (const [key, value] of Object.entries(def)) {
        lines.push(renderLoad(value, [...path, key]));
      }
      return lines.join('\n');
    }
  }

  const body = renderLoad(definition, []);
  return `export function loadInput(): Input {
  const cfg: any = {};
  ${body}
  return cfg as Input;
}`;
}

function generateActionYml(definition: Definition): string {
  function renderInputs(def: Definition, path: string[]): string {
    if (isInput(def)) {
      const lines: string[] = [];
      const inputName = path.join('-');
      lines.push(`  ${inputName}:`);
      if (def.description) {
        lines.push(`    description: ${JSON.stringify(def.description)}`);
      }
      if (def.default !== undefined) {
        lines.push(`    default: ${JSON.stringify(def.default)}`);
      }
      if (def.required) {
        lines.push(`    required: true`);
      }
      return lines.join('\n');
    } else {
      const lines: string[] = [];
      for (const [key, value] of Object.entries(def)) {
        lines.push(renderInputs(value, [...path, key]));
      }
      return lines.join('\n');
    }
  }

  const inputs = renderInputs(definition, []);
  return [
    `name: ${actionInfo.title}`,
    `description: >`,
    ...actionInfo.description
      .trim()
      .split('\n')
      .map((line) => `  ${line}`),
    `branding:`,
    `  icon: ${actionInfo.branding.icon}`,
    `  color: ${actionInfo.branding.color}`,
    `inputs:\n${inputs}`,
  ].join('\n');
}

const output = [
  `// THIS FILE IS AUTO-GENERATED BY 'tools/generate-input.ts'. DO NOT EDIT MANUALLY.`,
  `import * as core from '@actions/core';`,
  generateInputInterface(definition),
  generateLoadFunction(definition),
];

writeFileSync('src/input.ts', output.join('\n\n'));

writeFileSync(
  'action.yml',
  [
    `# THIS FILE IS AUTO-GENERATED BY 'tools/generate-input.ts'. DO NOT EDIT MANUALLY.`,
    generateActionYml(definition),
    `
runs:
  using: node20
  main: dist/index.js
`.trim(),
  ].join('\n'),
);
