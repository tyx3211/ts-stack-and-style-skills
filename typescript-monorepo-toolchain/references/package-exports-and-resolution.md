# Package Exports And Resolution

## Public Entries

Define every supported package entry explicitly. For an ESM dist-first package:

```json
{
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    },
    "./feature": {
      "types": "./dist/feature.d.ts",
      "import": "./dist/feature.js",
      "default": "./dist/feature.js"
    }
  }
}
```

Place `types` before runtime conditions. Export only intentional subpaths. Add `require` only when a real CJS artifact exists and test the dual-package boundary; do not point both conditions at incompatible files.

## Internal Imports

Use package `imports` for package-private aliases when the runtime supports them:

```json
{
  "imports": {
    "#core/*": "./dist/core/*.js"
  }
}
```

Entries use `#` specifiers and apply only inside the package. Keep source and dist mappings aligned with the selected consumption mode. Verify Node, TypeScript, tests, and bundlers all resolve them.

## TypeScript Paths

`paths` changes TypeScript resolution only; it does not rewrite emitted import specifiers. In TypeScript 7, do not use removed `baseUrl`; make targets relative to the config. Use `paths` for aliases already owned by a bundler or runtime, not to invent runtime behavior.

Vite 8 can opt into tsconfig path support with `resolve.tsconfigPaths`, but it is not enabled by default and does not make Node or other tools understand the alias.

## Deep Imports And Boundaries

Package `exports` encapsulates package-name subpaths, but a monorepo sibling may still bypass it with a relative filesystem import. Enforce both:

- package-name imports must match declared exports;
- cross-package relative imports are forbidden by lint/boundary rules.

Test that unexported subpaths fail from a packed consumer.

## `tsc-alias`

Treat `tsc-alias` as a legacy-only post-emit compatibility layer for a repository that cannot yet migrate emitted aliases to package exports/imports or relative runtime paths.

- Do not introduce it in a new package.
- Verify rewrites in JavaScript and declarations.
- Verify ESM file extensions, source maps, dynamic imports, conditional exports, and every entry point.
- Run packed consumer fixtures after rewriting.
- Keep a migration issue to remove it; a postprocessor hides resolver disagreement rather than eliminating it.
