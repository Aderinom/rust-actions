# Rust All Action

Simple GitHub Action to run multiple Rust workflows.  
Including: `test`, `clippy`, `fmt`, `doc`, `shear`, `deny`.

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

To enable artifact caching use

```yaml
jobs:
  rust-all:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aderinom/rust-all-action@v1
        with:
          buildCacheStrategy: 'github'
          # If no cache is avaiable, tries to fall back to a cahe of this branch
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

If you prefer running seperate jobs (not really reccomended because of build overhead), use following config:

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

To run additional tools, you can install and cache additional Cargo tools by supplying a comma‑separated list via `installAdditional`.

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
    run: 'all-default' # Workflows which's tools will be installed
    installAdditional: cargo-audit@latest, cargo-sbom #Additional tools to install
    installOnly: true
```

## Inputs

| Input               | Description                                               | Default       |
| ------------------- | --------------------------------------------------------- | ------------- |
| `project`           | Path to Rust project.                                     | `./`          |
| `cacheKey`          | Cache key for installed tools. Use `no-cache` to disable. | `rax-cache`   |
| `run`               | Comma-separated list of workflows to execute.             | `all-default` |
| `toolchain`         | Default Rust toolchain.                                   | _(none)_      |
| `installAdditional` | Additional cargo tools to install                         | _(none)_      |
| `installOnly`       | Only installs and caches toolchains and tools             | false         |

### Workflow Overrides

Each workflow supports `toolchain` and `overrideArgs` inputs.
`clippy` also supports `denyWarnings`.

| Workflow | Input                    | Description                   | Example                    |
| -------- | ------------------------ | ----------------------------- | -------------------------- |
| `test`   | `flow-test-toolchain`    | Override toolchain for tests. | `nightly`                  |
|          | `flow-test-overrideArgs` | args for `cargo test`.        | `--all-features --release` |
| ...      | ...                      | ...                           | ...                        |

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
