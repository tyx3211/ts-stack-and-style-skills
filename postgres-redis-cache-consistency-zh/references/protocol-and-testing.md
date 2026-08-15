# 协议与测试参考

## 目录

- 原子 version-floor 行为
- 确定性竞态 harness
- Outbox 与投影用例
- Lease 与 fencing 用例
- 静态与运行门禁

## 原子 Version-Floor 行为

每个状态转移只使用一个 Redis 服务端原子操作。不得把读、比较、写拆成多条命令。

推荐抽象状态：

```json
{
  "floorVersion": "43",
  "data": {
    "version": "43",
    "digest": "sha256:...",
    "value": {}
  }
}
```

必须无损编码 64-bit version。JavaScript `number` 在 `2^53 - 1` 以上不安全；使用十进制字符串或支持 `bigint` 的 codec。

`markFloor(v)` 必须单调。`put(v,digest,value)` 必须原子完成：

1. 拒绝 `v < floorVersion`；
2. 拒绝 `v < currentData.version`；
3. 拒绝并报告同版本不同 digest；
4. 允许同版本同 digest 的幂等重放；
5. 允许当前 floor 对应的已验证 clean value；
6. 按策略保留 TTL 与观测到的最大 floor。

floor 保留期不得短于最大在途 fill 加失效恢复窗口。显式测试过期与淘汰；栅栏消失后，strict reader 必须从主库重新建立新鲜度下限。

只有两个 key 在 Redis Cluster 的同一 hash slot 且所有转换保持原子时，才使用独立 metadata key。单一编码状态更简单。

## 确定性 Testcontainers Harness

使用真实 PostgreSQL 与 Redis container。不得用随意 sleep 模拟竞态。由测试显式控制 barrier：

```ts
const readCompleted = deferred<void>();
const allowFill = deferred<void>();

const slowRead = cache.getForTest(id, {
  afterDatabaseRead: async () => {
    readCompleted.resolve();
    await allowFill.promise;
  },
});

await readCompleted.promise;
await updateAggregateToV43(id);
allowFill.resolve();
await slowRead;
```

生产 adapter 不必公开测试 hook。在 integration harness 中注入狭窄的 barrier/observer port，或暂停受控的 repository/fill 阶段。

### 必测交错

1. **DEL 后旧 miss 回填**
   - R1 miss 并读到 v42。
   - W1 commit v43 并失效。
   - R1 恢复。
   - 证明 weak cache 可能保存 v42；证明 v43 floor 会拒绝它。

2. **重建 writer 乱序**
   - W1 得到 v42，在写 Redis 前暂停。
   - W2 把 v43 写进 Redis。
   - W1 恢复。
   - 断言缓存 version 不会降到 43 以下。

3. **同版本冲突**
   - 依次提交 v43/digest A 与 v43/digest B。
   - 断言第二次被拒绝并产生 metric/error。

4. **Commit 后崩溃**
   - commit 聚合与 outbox row。
   - 在 Redis 操作前终止请求路径。
   - 启动 consumer，断言投影收敛。

5. **Redis timeout/unknown**
   - 让 Redis 执行命令，但丢弃或延迟回复。
   - 断言重试幂等、PostgreSQL 不 rollback、outbox 仍可恢复。

6. **副本延迟**
   - primary 已 commit v43，而读取源仍暴露 v42。
   - 断言 strict/minVersion 重建拒绝 replica 结果。

7. **负缓存竞态**
   - 缓存 `missing` v42，随后在 v43 创建实体，再重放旧的 negative fill。
   - 断言 v43 floor/tombstone 协议不会继续隐藏实体。

## Outbox 与投影用例

对完整状态通知，按 `42,44,43,44` 且带重复的顺序投递。断言：

- `eventId` 唯一处理保持幂等；
- 聚合 high-water mark 永不下降；
- Redis 发布 version 44 或更高的完整权威快照。

对 delta，扣住 version 43 后投递 44。断言 consumer 检测 gap，并在重载状态或补放缺失 delta 前不应用 44。

独立测试周期性 reconcile。删除或淘汰 Redis 投影，断言可以从 PostgreSQL 重建，且不把 Redis 历史当成权威。

## Lease 与 Fencing 用例

使用保存 `lastAcceptedFence` 的 fake durable sink，并拒绝 `fence <= lastAcceptedFence`。

1. Worker A 获得 fence 10，暂停到 lease 过期。
2. Worker B 获得 fence 11，写入成功。
3. Worker A 带 fence 10 恢复。
4. 断言 sink 拒绝 A。

再仅使用随机 ownership token 重跑，以证明 compare-and-delete 能保护释放，却无法为 sink 写入排序。

## 静态与运行门禁

- ESLint restricted imports 或架构测试：handler、usecase、DB transaction module 禁止 raw Redis client。
- 类型化缓存注册表：强制 consistency、stale budget、miss source、failure policy、TTL、write protocol。
- Schema 门禁：aggregate version 使用 `bigint`；outbox 有唯一 `event_id` 及 aggregate/version 索引。
- 评审门禁：影响投影的每个依赖写都在同一事务 bump aggregate version。
- 指标：hit/miss/bypass、served version age、floor rejection、digest conflict、Redis unknown outcome、outbox oldest age、retry、dead letter、reconcile repair。
- 观测旧值超过注册预算时报警；不得把缓存重新标称为强一致。
