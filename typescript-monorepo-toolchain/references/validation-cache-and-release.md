# Validation, Cache, And Release

## Shared Commands

Root scripts should expose stable commands and delegate to package scripts or the task runner:

```text
generate -> boundary/lint -> typecheck -> test -> build -> artifact checks
```

Run generation before checks that consume generated contracts or clients. Keep `build` trustworthy: do not let it mean transpile-only when the repository policy promises verified artifacts.

## Cache Inputs And Outputs

Include all semantic inputs:

- package source, tsconfig chain, package metadata, lockfile, environment schema;
- bundler/compiler/lint/test config and relevant tool versions;
- code generators, schemas, API contracts, migration metadata;
- environment variables that actually alter artifacts, represented without leaking secrets.

Declare outputs precisely: `dist`, declarations, maps, generated clients/specs, and task-specific build info. Use separate `tsBuildInfoFile` paths for concurrent commands. Never cache tests or builds whose undeclared environment/input changes behavior.

## Clean Validation

CI must periodically prove a clean graph:

1. clean checkout and frozen/locked install;
2. no pre-existing `dist`, generated output, or build info;
3. generation and drift check;
4. dependency-boundary and undeclared-dependency checks;
5. full typecheck, tests, and builds;
6. artifact and packed-consumer validation.

Affected-only CI is an optimization, not the sole correctness gate. Run a full clean validation on protected branches or a documented cadence.

## Packed Consumer Fixtures

Validate what users install, not the workspace symlink:

1. create the package tarball with the repository package manager;
2. inspect the file list for missing declarations/runtime files and leaked source/secrets;
3. install the tarball into minimal fixtures outside the workspace graph;
4. run TypeScript typecheck and runtime import/require tests for every supported mode;
5. test public subpaths and verify private deep imports fail;
6. test a bundler consumer when browser/bundler support is promised.

Use fixtures such as:

```text
fixtures/consumer-node-esm
fixtures/consumer-node-cjs        # only if CJS is supported
fixtures/consumer-vite
fixtures/consumer-typescript
```

Add package validators such as publint or Are the Types Wrong when they fit the publication policy, but keep executable consumer fixtures as the final evidence.

## Release Order

- Publish dependencies before dependents when packages are versioned separately.
- Verify workspace ranges become valid published ranges.
- Generate changelog/version metadata from intentional changes, not incidental rebuild noise.
- Block release when packed contents or API reports differ unexpectedly.
- For private packages, still run artifact checks when deployment consumes packed or copied output.
