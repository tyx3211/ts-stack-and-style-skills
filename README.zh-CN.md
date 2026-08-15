# TS Stack And Style Skills

[English](README.md) | 中文

这是一个 Codex 优先、英中双语的 TypeScript skill 仓库，覆盖技术栈选型、源码设计、仓库工具链、应用安全、异步控制流以及 PostgreSQL/Redis 正确性。

仓库包含 8 个可独立安装的英文 skill 和 8 个中文镜像，共 16 个 skill 目录：

- `choosing-typescript-stack{,-zh}`
- `typescript-coding-preferences{,-zh}`
- `strict-typescript-source-gates{,-zh}`
- `backend-data-correctness{,-zh}`
- `typescript-monorepo-toolchain{,-zh}`
- `postgres-redis-cache-consistency{,-zh}`
- `async-application-correctness{,-zh}`
- `typescript-security-boundaries{,-zh}`

## 职责分层

- **技术栈选型**：选择框架、运行时、契约、存储、队列和项目形态。
- **编码偏好**：管理普通 TypeScript 建模、边界、组合方式和局部实现风格。
- **源码门禁**：把已选定的源码政策落实为 tsconfig、lint、hook 和 CI 规则。
- **后端数据正确性**：管理 PostgreSQL 事务、不变量、幂等、outbox、worker 与 Redis 的一般边界。
- **Monorepo 工具链**：管理 workspace、包依赖图、project references、exports、声明产物、任务缓存和发布/构建边界。
- **PostgreSQL/Redis 缓存一致性**：聚焦跨存储 cache-aside 顺序、失效、所有权、恢复和一致性审查。
- **异步应用正确性**：管理 Promise 控制流、取消、任务所有权、状态机和应用级并发边界。
- **安全边界**：管理浏览器、HTTP、认证、文件、URL 与 Electron 的信任边界，并区分静态发现和威胁模型假设。

每个 skill 都是自包含 bundle，包括 `SKILL.md`、`agents/openai.yaml` 和可选的 `references/` 或 `scripts/`。英文版与中文版刻意保持为独立目录，任何一方都可以单独安装，不依赖另一方的文件。

## 仓库验证

使用支持 ESM 的 Node.js，并安装锁定的开发依赖。仓库并列安装推荐的 TypeScript 7 CLI 与 TypeScript 6 compatibility CLI/API；AST 逃生舱审计绝不 fallback 到 global compiler：

```bash
npm install
npm run validate
```

结构验证器会动态扫描所有包含 `SKILL.md` 的顶层目录，并检查：

- skill 与元数据文件可按 UTF-8 读取；
- Markdown code fence 成对闭合，且本地 Markdown 链接目标存在；
- frontmatter 只能包含 `name` 和 `description`，且 `name` 与目录名一致；
- `SKILL.md` 不超过 500 行；
- `references/` 链接存在，且最多只有一层；
- `agents/openai.yaml` 包含加引号的 display、short-description 和 default-prompt 字段；
- short description 长度为 25–64 个字符，default prompt 包含 `$skill-name`；
- 每个英文/中文 skill 对都存在、具有镜像文件结构，且每个 Markdown 文件的 fenced-code-block 数量一致。

路由 fixture 验证器要求每个动态发现的英文 skill 都有英文和中文的正例与负例 prompt，并有一条记录 companion skill 与 reference 预期的混合 prompt：

```bash
npm run validate:routing
```

完整验证会先证明项目本地 `tsc` 是 TypeScript 7.0.x、`tsc6` 与可嵌入的 `typescript` API 是 TypeScript 6.0.x，且没有借用 global installation；随后运行两份 TypeScript 逃生舱 inventory script 的正反 fixture，并报告 parser version。可分别用 `npm run validate:toolchain` 与 `npm run validate:type-escape-harness` 单独运行。

这些检查只验证结构和已记录的路由覆盖。它们不能证明 skill 一定会正确触发、英中翻译语义等价，也不能证明技术、安全、并发或架构建议正确；这些仍然需要前向测试与人工审计。

## 安装

把需要的 skill 目录复制到 Codex 本地 skill 目录（通常为 `~/.codex/skills/`），并保持每个目录内部路径不变。根目录的 `scripts/` 不是可安装 skill，不要复制过去。

## 许可证

MIT
