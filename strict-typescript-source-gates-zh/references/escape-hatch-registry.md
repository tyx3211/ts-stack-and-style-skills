# TypeScript 逃生舱登记

## 分类

把这份 registry 当作 TypeScript 对 Rust `unsafe` 审查纪律的类比，而不是禁用清单。必要逃生舱可能让实现和互操作更清晰；要求是暴露并缩小可信表面、写明 invariant、尽可能绑定可执行证据，并让发版审查足够便宜。与 Rust `unsafe` 不同，这个边界由项目政策、lint、inventory、测试和人工 review 强制，而不是由 TypeScript 语言本身强制。

手写生产源码禁止：显式/隐式 `any`、`@ts-ignore`、`@ts-nocheck`、double assertion、未验证外部值被当应用类型、审查模块外 production monkey patch、blanket/file-wide lint disable，以及未 `checkJs`/validated adapter 的 JS 进入 core。

仅允许已审查：`as const` 外 assertion、non-null/definite-assignment、显式 predicate/asserts、overload/conditional-generic correlation、HTTP/SDK/database/IPC/DOM/storage 的 caller-supplied generic runtime claim、method-shaped assignable boundary、bivariance hack、open optional/rest callback arity、参数缩窄 compatibility adapter、generic construct signature、brand construction、ambient declaration/`.d.ts`/augmentation/merging、极少数 tracked 单行 `@ts-expect-error`、精确规则最小范围 lint disable、kernel index assertion、实测的 app `skipLibCheck:true`，以及 unchecked JS、`noCheck`、被排除 runtime source 或 compatibility type universe 等已登记配置放宽。

不是逃生舱：校验前 `unknown`、`satisfies`、允许的 `as const`、schema success/error parsing 和 checker 理解的普通 narrowing。`readonly` 不是逃生舱，但只是浅层。

## 标签与 Inventory

使用紧邻的前置注释或同一行尾部 `[SAFETY]:`、`[TRUSTME]:`、`[INDEX INVARIANT]:` 注释，并写出实际证据；中括号和其后的冒号都是必需语法，旧式无括号标签不算登记。中间出现无关语句就会断开关联。declaration、augmentation、merging 和 monkey patch 必须用 `[TRUSTME]:`；non-null 索引接受 `[INDEX INVARIANT]:` 或 `[SAFETY]:`；其他受审逃生舱接受 `[SAFETY]:` 或 `[TRUSTME]:`。block / file-wide 或多规则 lint disable 始终是 policy failure，不能靠标签放行。脚本只记录声明，不判断内容真假。

```sh
node <skill>/scripts/audit-type-escapes.mjs src
node <skill>/scripts/audit-type-escapes.mjs --json src packages/core/src
node <skill>/scripts/audit-type-escapes.mjs --deny-unreviewed src
node <skill>/scripts/audit-type-escapes.mjs --compatibility-heuristics src
```

默认脚本枚举：除 `as const` 外 assertion、non-null/definite assignment、显式 predicate/asserts、overload、generic construct signature、常见 caller-supplied runtime generic、TS directive、lint disable、ambient declaration/augmentation 及 prototype/global mutation clue。选择启用的 compatibility heuristic 还会报告带参数 method signature 与 open optional/rest function type；它是高噪声定向审查辅助，不是默认 deny gate，也不能证明实际发生了不安全 assignment。项目特定 generic API 与配置逃生舱仍需额外 gate。脚本不证明 runtime validation、alias/effect、density、variance 或 overload correctness，可能误报漏报。

发版流程：full lint 和权威 `tsc`；deny unreviewed escapes；需要时 diff JSON baseline；审查变化声明；核验 declaration/runtime provider；运行 parser/predicate/brand/overload negative tests 和 kernel property/fuzz tests。目录名 `unsafe` 只能缩小审计面，不能自动放行内容。
