# 验证、缓存与发布

## 共享命令

Root scripts 暴露稳定命令，并委托给 package script 或 task runner：

```text
generate -> boundary/lint -> typecheck -> test -> build -> artifact checks
```

消费生成 contract/client 的检查必须在 generation 后执行。保持 `build` 可信：仓库政策承诺 verified artifact 时，禁止让 build 只代表 transpile。

## 缓存输入输出

纳入全部语义输入：

- package source、tsconfig chain、package metadata、lockfile、environment schema；
- bundler/compiler/lint/test 配置与相关工具版本；
- code generator、schema、API contract、migration metadata；
- 确实影响产物的环境变量，但表达时不得泄露 secret。

精确声明输出：`dist`、声明、map、生成 client/spec 与 task-specific build info。并发命令使用独立 `tsBuildInfoFile`。如果未声明的环境/输入会改变行为，禁止缓存对应 test/build。

## Clean Validation

CI 必须定期证明 clean graph：

1. clean checkout 与 frozen/locked install；
2. 不存在预先生成的 `dist`、generated output 或 build info；
3. generation 与 drift check；
4. dependency-boundary 与 undeclared-dependency 检查；
5. 完整 typecheck、test 与 build；
6. artifact 与 packed-consumer 验证。

Affected-only CI 只是优化，不能成为唯一 correctness gate。保护分支或明确周期必须运行 full clean validation。

## Packed Consumer Fixtures

验证用户实际安装的内容，而不是 workspace symlink：

1. 用仓库 package manager 生成 package tarball；
2. 检查文件清单，发现缺失声明/runtime 文件与泄露源码/secret；
3. 在 workspace graph 外的最小 fixture 安装 tarball；
4. 对每个受支持模式运行 TypeScript typecheck 与 runtime import/require test；
5. 测试公开 subpath，并确认私有 deep import 失败；
6. 承诺 browser/bundler 支持时测试 bundler consumer。

Fixture 示例：

```text
fixtures/consumer-node-esm
fixtures/consumer-node-cjs        # 仅支持 CJS 时
fixtures/consumer-vite
fixtures/consumer-typescript
```

发布政策合适时加入 publint 或 Are the Types Wrong 等 validator，但 executable consumer fixture 才是最终证据。

## 发布顺序

- package 独立版本化时先发布 dependency，再发布 dependent。
- 验证 workspace range 会变成有效 published range。
- changelog/version metadata 来自有意变更，而不是偶然 rebuild noise。
- packed contents 或 API report 意外变化时阻止发布。
- 私有 package 的部署若消费 pack/copy 产物，也必须跑 artifact check。
