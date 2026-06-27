# Rust All Action

Simple GitHub Action to run multiple Rust workflows.  
Includes: `test`, `clippy`, `fmt`, `doc`, `shear`, `deny`.

Designed as a baseline CI for Rust projects.

By default:

- Uses binstall to download prebuild binaries
- Caches installed tools between runs
- Caches installed toolchains
- Supports workflow-specific toolchain and argument overrides

To cache compilation between runs, use [sccache](https://github.com/Mozilla-Actions/sccache-action)

---

## Usage

To run all default workflows just add:

```yaml
jobs:
  rust-all:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aderinom/rust-all-action@v1
```

To enable artifact caching, use:

```yaml
jobs:
  rust-all:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aderinom/rust-all-action@v1
        with:
          buildCacheStrategy: 'github'
          # If no cache is available, tries to fall back to a cache of this branch
          buildCacheFallbackBranch: 'main'
```

Or with sccache:

```yaml
jobs:
  rust-all:
    env:
      SCCACHE_GHA_ENABLED: 'true'
      RUSTC_WRAPPER: 'sccache'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # Start sccache for compilation caching
      - name: Run sccache-cache
        uses: mozilla-actions/sccache-action@v0.0.9
      # Run the rust workflow
      - uses: aderinom/rust-all-action@v1
```

Setting a toolchain for one specific workflow:

```yaml
jobs:
  rust-all:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aderinom/rust-all-action@v1
        with:
          buildCacheStrategy: 'github'
          # If no cache is available, tries to fall back to a cache of this branch
          buildCacheFallbackBranch: 'main'
          flow-fmt-toolchain: 'nightly'
```

If you prefer running separate jobs (not really recommended because of build overhead), use the following config:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aderinom/rust-all-action@v1
        with:
          run: 'test'

  clippy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aderinom/rust-all-action@v1
        with:
          run: 'clippy'

  fmt:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aderinom/rust-all-action@v1
        with:
          run: 'fmt'

  doc:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aderinom/rust-all-action@v1
        with:
          run: 'doc'

  shear:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aderinom/rust-all-action@v1
        with:
          run: 'shear'
```

### Custom Workflows

To run additional tools, you can install and cache Cargo tools by supplying a comma-separated list via `installAdditional`.

```yaml
- uses: aderinom/rust-all-action@v1
  with:
    run: ''
    installAdditional: cargo-audit@latest, cargo-sbom
```

### Install Only

To pre-warm the tool cache, you can optionally have a workflow which installs and caches all required tools.

```yaml
- uses: aderinom/rust-all-action@v1
  with:
    run: 'all-default' # Workflows whose tools will be installed
    installAdditional: cargo-audit@latest, cargo-sbom # Additional tools to install
    installOnly: true
```

### Tips

The C drive of Windows runners is extremely slow.
If you are running on windows, consider using [setup dev drive](https://github.com/marketplace/actions/setup-dev-drive) to speed up compilation and caching.

## Inputs

| Input                      | Description                                                 | Default       |
| -------------------------- | ----------------------------------------------------------- | ------------- |
| `project`                  | Path to the Rust project.                                   | `.`           |
| `profile`                  | Cargo build profile to use.                                 | _(none)_      |
| `run`                      | Comma-separated list of workflows to execute.               | `all-default` |
| `cacheKey`                 | Cache key for installed tools. Use `no-cache` to disable.   | `rax-cache`   |
| `toolchain`                | Default Rust toolchain.                                     | _(none)_      |
| `extraComponents`          | Additional toolchain components to install e.g. `rust-src`. | _(none)_      |
| `installAdditional`        | Additional Cargo tools to install.                          | _(none)_      |
| `installOnly`              | Only installs and caches toolchains and tools.              | `false`       |
| `buildCacheStrategy`       | `github` to enable build caching through GitHub Cache.      | `none`        |
| `buildCacheFallbackBranch` | Fallback branch for build cache if the branch has none.     | `main`        |

### Workflow Overrides

Every workflow accepts `toolchain` and `overrideArgs` inputs, named `flow-<workflow>-<input>`,
where `<workflow>` is one of `test`, `clippy`, `fmt`, `doc`, `shear`, or `deny`.
Some workflows expose additional inputs.

| Input                          | Applies to | Description                          | Default  |
| ------------------------------ | ---------- | ------------------------------------ | -------- |
| `flow-<workflow>-toolchain`    | all        | Override the Rust toolchain.         | _(none)_ |
| `flow-<workflow>-overrideArgs` | all        | Replace the default cargo arguments. | _(none)_ |
| `flow-test-failFast`           | `test`     | Stop tests on the first failure.     | `false`  |
| `flow-clippy-denyWarnings`     | `clippy`   | Treat clippy warnings as errors.     | `true`   |

Examples: `flow-fmt-toolchain: nightly` or `flow-test-overrideArgs: '--all-features --release'`.

## Contributing

Contributions are welcome. If you’d like to add another workflow or adjust existing behavior, fork the repository and open a pull request.

### Setup

```bash
pnpm i
```

This installs all dependencies and development tooling.

### Testing

The repository includes a minimal Rust cargo project used for integration tests.
Tests are executed against this local project to validate configuration parsing and workflow behavior.

Run tests with:

```bash
pnpm test
```

All tests use the native Node.js test runner (`node:test`) and strict assertions from `node:assert/strict`.
