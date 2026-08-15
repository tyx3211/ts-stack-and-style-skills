# Runtime And TSConfig Reference

## New Project Baseline

Use this baseline unless the project has a clear reason to be CommonJS, browser-only, or framework-managed:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": false
  }
}
```

`NodeNext` keeps TypeScript aligned with Node's ESM/CommonJS package resolution rules. `esModuleInterop: true` reduces friction with common npm packages that still expose CommonJS-style exports.

Keep `skipLibCheck: false` for libraries, shared/contracts packages, infrastructure, and trust-boundary code. A large leaf app may set it to `true` only as a measured, documented performance compromise; that choice expands trust in dependency declarations. Use `strict-typescript-source-gates` for the complete source baseline and `typescript-monorepo-toolchain` for package exports and cross-package resolution.

## Runtime Preference

- Conservative server runtime: Node.js 24.
- Bun-first product/DX runtime: latest stable Bun available in the environment.
- Edge/serverless runtime: follow the target platform first, then keep business code framework-independent.

Do not rewrite an existing CommonJS project to `NodeNext` incidentally. Treat module-system migration as an explicit task because package exports, import file extensions, test runners, and build output can all be affected.
