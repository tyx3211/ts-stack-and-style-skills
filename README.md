# TS Stack And Style Skills

English | [中文](README.zh-CN.md)

Codex-first open-source skill pack for TypeScript stack selection and TypeScript coding style decisions.

This repository packages four complete skills:

- `choosing-typescript-stack`
- `typescript-coding-preferences`
- `choosing-typescript-stack-zh`
- `typescript-coding-preferences-zh`

Each skill includes its own `SKILL.md`, `references/`, and `agents/openai.yaml`, so users can reproduce the original behavior instead of copying only the top-level markdown.

## Codex First

This repository is organized for Codex skill installation first.

- Primary target: Codex local skill directory such as `~/.codex/skills/`
- Compatible shape: `skill-name/SKILL.md` plus optional `references/` and `agents/`
- Secondary compatibility: other agent environments that can read the same skill layout

## Included Skills

### `choosing-typescript-stack`

Use when choosing or comparing TypeScript project stacks, frontend frameworks, backend frameworks, API contract styles, schema libraries, databases, auth, queues, testing, observability, or monorepo structure.

### `typescript-coding-preferences`

Use when writing, refactoring, or reviewing TypeScript code with a preference for schema-first boundaries, function-first flow, data-first modeling, strict type safety, and lighter-weight architecture.

### `choosing-typescript-stack-zh`

Chinese edition of the stack selection skill, including translated references.

### `typescript-coding-preferences-zh`

Chinese edition of the coding preferences skill, including translated references.

## Repository Layout

```txt
ts-stack-and-style-skills/
  README.md
  README.zh-CN.md
  LICENSE
  .gitignore
  choosing-typescript-stack/
  typescript-coding-preferences/
  choosing-typescript-stack-zh/
  typescript-coding-preferences-zh/
```

## Installation

### Codex

Copy one or more skill directories into the local Codex skill directory:

```bash
mkdir -p ~/.codex/skills
cp -r choosing-typescript-stack ~/.codex/skills/
cp -r typescript-coding-preferences ~/.codex/skills/
cp -r choosing-typescript-stack-zh ~/.codex/skills/
cp -r typescript-coding-preferences-zh ~/.codex/skills/
```

After that, the skills can be referenced by name in Codex prompts or selected when the triggering conditions match.

### Other Environments

If another agent environment supports `SKILL.md`-style skill bundles, copy the same directories into that environment's skill search path and keep the internal relative paths unchanged.

## Notes

- The English editions are preserved as direct skill bundles with light metadata cleanup.
- The Chinese editions translate both the main skill files and the referenced supporting documents.
- Relative links inside each skill are kept valid within that skill directory.

## License

MIT
