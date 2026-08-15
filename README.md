# TS Stack And Style Skills

English | [中文](README.zh-CN.md)

Codex-first, bilingual skills for TypeScript stack selection, source design, repository toolchains, application security, asynchronous control flow, and PostgreSQL/Redis correctness.

The repository contains eight independently installable English skills and eight Chinese mirrors (16 skill directories):

- `choosing-typescript-stack{,-zh}`
- `typescript-coding-preferences{,-zh}`
- `strict-typescript-source-gates{,-zh}`
- `backend-data-correctness{,-zh}`
- `typescript-monorepo-toolchain{,-zh}`
- `postgres-redis-cache-consistency{,-zh}`
- `async-application-correctness{,-zh}`
- `typescript-security-boundaries{,-zh}`

## Responsibility Layers

- **Stack selection** chooses frameworks, runtimes, contracts, storage, queues, and project shape.
- **Coding preferences** govern ordinary TypeScript modeling, boundaries, composition, and local implementation style.
- **Source gates** turn selected source policies into tsconfig, lint, hook, and CI enforcement.
- **Backend data correctness** owns PostgreSQL transactions, invariants, idempotency, outbox, workers, and general Redis boundaries.
- **Monorepo toolchain** owns workspaces, package graphs, project references, exports, declarations, task caching, and release/build boundaries.
- **PostgreSQL/Redis cache consistency** focuses on cross-store cache-aside ordering, invalidation, ownership, recovery, and consistency review.
- **Asynchronous application correctness** owns Promise control flow, cancellation, task ownership, state machines, and application-level concurrency boundaries.
- **Security boundaries** own browser/HTTP/auth/file/URL/Electron trust boundaries and separate static findings from threat-model assumptions.

Each skill is a self-contained bundle with `SKILL.md`, `agents/openai.yaml`, and optional `references/` or `scripts/`. English and Chinese bundles intentionally remain separate so either language can be installed without depending on its mirror.

## Repository Validation

Use Node.js with ESM support and install the locked development dependencies. The repository installs the recommended side-by-side TypeScript 7 CLI and TypeScript 6 compatibility CLI/API, and the AST escape-audit harness never falls back to a global compiler.

```bash
npm install
npm run validate
```

The structure validator dynamically scans top-level directories containing `SKILL.md` and checks:

- UTF-8-readable skill and metadata files;
- balanced Markdown code fences and existing local Markdown link targets;
- frontmatter contains only `name` and `description`, and `name` matches the directory;
- `SKILL.md` is at most 500 lines;
- linked `references/` files exist and links are no more than one level deep;
- `agents/openai.yaml` contains quoted display, short-description, and default-prompt fields;
- short descriptions contain 25–64 characters and default prompts mention `$skill-name`;
- every English/Chinese pair exists, has a mirrored file structure, and keeps the same fenced-code-block count per Markdown file.

The routing fixture validator requires positive and negative English and Chinese prompt examples for every dynamically discovered English skill, plus a mixed prompt that records expected companion skills and references:

```bash
npm run validate:routing
```

The full validator first proves that the project-local `tsc` is TypeScript 7.0.x, `tsc6` and the embeddable `typescript` API are TypeScript 6.0.x, and no global installation is involved. It then runs the positive/negative fixtures for both copies of the TypeScript escape-hatch inventory script and reports its parser version. Run these checks separately with `npm run validate:toolchain` and `npm run validate:type-escape-harness`.

These checks validate structure and documented routing coverage only. They do not prove that a skill will trigger correctly, that translations are semantically equivalent, or that technical, security, concurrency, and architecture advice is correct. Those remain forward-test and human-review responsibilities.

## Installation

Copy only the skill directories you need into the Codex skill directory, normally `~/.codex/skills/`, while preserving each directory's internal paths. Do not copy the root `scripts/` directory as an installable skill.

## License

MIT
