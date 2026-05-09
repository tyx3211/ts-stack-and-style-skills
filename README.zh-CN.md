# TS Stack And Style Skills

[English](README.md) | 中文

这是一个面向 Codex 优先使用场景的开源 skill 仓库，聚焦于 TypeScript 技术选型与 TypeScript 编码风格约束。

本仓库一共提供 4 个完整 skill：

- `choosing-typescript-stack`
- `typescript-coding-preferences`
- `choosing-typescript-stack-zh`
- `typescript-coding-preferences-zh`

每个 skill 都包含完整的 `SKILL.md`、`references/` 和 `agents/openai.yaml`，因此我们提供的是可直接复现的完整 skill 包，而不是只复制顶层 markdown 的精简版本。

## 优先支持 Codex

本仓库的目录组织方式首先面向 Codex 的本地 skill 安装路径。

- 首要目标环境：Codex，本地 skill 目录通常为 `~/.codex/skills/`
- 采用的结构：`skill-name/SKILL.md`，并可带 `references/`、`agents/`
- 次级兼容目标：其他支持同类 skill 目录结构的代理环境

## 仓库内包含的 Skill

### `choosing-typescript-stack`

用于 TypeScript 项目的技术选型与对比，包括前端框架、后端框架、API 契约方式、运行时 schema（运行时校验结构）、数据库、认证、队列、测试、可观测性与 monorepo（单仓多包）结构等。

### `typescript-coding-preferences`

用于 TypeScript 代码的编写、重构与审查，核心偏好是：边界以 schema（运行时校验结构）为先、流程以函数和模块为先、建模以数据为先，并尽量避免沉重的 Java / Spring 风格分层。

### `choosing-typescript-stack-zh`

技术选型 skill 的中文版，包含配套 references（参考文档）的中文版。

### `typescript-coding-preferences-zh`

编码偏好 skill 的中文版，包含配套 references（参考文档）的中文版。

## 仓库结构

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

## 安装方式

### Codex

把需要的 skill 目录复制到本地 Codex skill 目录中：

```bash
mkdir -p ~/.codex/skills
cp -r choosing-typescript-stack ~/.codex/skills/
cp -r typescript-coding-preferences ~/.codex/skills/
cp -r choosing-typescript-stack-zh ~/.codex/skills/
cp -r typescript-coding-preferences-zh ~/.codex/skills/
```

复制完成后，就可以在 Codex 中按名称引用这些 skill，或者在触发条件匹配时让系统加载它们。

### 其他代理环境

如果其他代理环境支持 `SKILL.md` 风格的 skill 包，也可以直接复制同样的目录结构过去。需要注意的是，skill 内部的相对路径依赖 `references/` 和 `agents/` 的原始层级，因此不要随意改动目录结构。

## 说明

- 英文版 skill 保留原始结构，并对元数据做了轻量整理。
- 中文版 skill 不只翻译主文档，也翻译了所有被引用的参考文档。
- 每个 skill 内部的相对引用都保持可用，便于直接复制安装。

## 许可证

MIT
