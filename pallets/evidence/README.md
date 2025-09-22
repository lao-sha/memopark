## pallet-evidence 说明

本 pallet 用于登记与链接跨域“证据”条目，支持两类模式并存：

- V1：按 `(domain:u8, target_id:u64)` 存储明文 CID 列表（imgs/vids/docs）。
- V2：按 `(ns:[u8;8], subject_id:u64)` 存储承诺哈希 `commit:H256`（不落明文）。

### 改进要点（v0.2）

- 新增 `CommitIndex(H256 -> id)`: 防止重复 `commit` 提交。
- 细化错误码：区分权限、数量超限、CID 非法/重复、命名空间不匹配等。
- CID 校验：仅允许可见 ASCII 字符(0x21..=0x7E)，非空，组内去重。
- 授权一致性：
  - `link/unlink` 改为基于目标 `Evidence.ns` 授权；
  - `link_by_ns/unlink_by_ns` 强制 `Evidence.ns == ns`；
- 事件沿用，新增约束不改变事件数据结构。

### 常量与配置

- `MaxCidLen/MaxImg/MaxVid/MaxDoc/MaxMemoLen`：CID 长度与数量上限。
- `EvidenceNsBytes: [u8;8]`：默认命名空间（用于 V1 提交）。
- `Authorizer`：运行时适配器，校验 `(ns, who)` 是否有权限。

### Extrinsics

- `commit(domain, target_id, imgs, vids, docs, memo)`：V1 提交明文 CID 列表。
  - 校验：CID 格式、重复、数量上限。
  - 授权：使用 `EvidenceNsBytes` 与 `who` 进行鉴权。

- `commit_hash(ns, subject_id, commit, memo)`：V2 提交承诺哈希。
  - 防重：`CommitIndex` 确保唯一。
  - 授权：基于入参 `ns`。

- `link(domain, target_id, id)` / `unlink(domain, target_id, id)`：V1 链接/取消。
  - 授权：读取 `Evidence(id).ns` 并对其鉴权。

- `link_by_ns(ns, subject_id, id)` / `unlink_by_ns(ns, subject_id, id)`：V2 链接/取消。
  - 约束：`Evidence(id).ns == ns`。

### 错误码

- `NotAuthorized`：无权限。
- `NotFound`：证据不存在。
- `TooManyImages/TooManyVideos/TooManyDocs`：数量超限。
- `InvalidCidFormat`：CID 非法（非可见 ASCII/为空/超长）。
- `DuplicateCid`：组内重复 CID。
- `CommitAlreadyExists`：承诺已存在。
- `NamespaceMismatch`：证据命名空间不匹配。

### CID 不加密约束

- 全局要求：CID 不加密。V2 的 `commit` 建议对“明文 CID + salt + 版本 + ns/subject”取哈希；不接受密文 CID 作为承诺来源。

### 前端集成建议（移动端优先）

- 默认使用 V2：`memo_ipfs` 或其他模块在前端持有明文 CID，仅上链 `commit`；
- 仅在需公开索引的场景使用 V1；
- 显示精细错误：数量超限/格式错误/命名空间不匹配/承诺重复；
- 分页查询（未来版本）：建议按 `(ns, subject)` 或 `(domain, target)` 分页获取 `id` 列表。

### 分页查询（P1/A：零破坏，直接用 entriesPaged）

不新增链上接口，直接用 RPC 的分页 Entries：

```ts
// 按命名空间与主体分页读取（建议 pageSize 50～200）
let startKey: string | null = null;
const pageSize = 100;
while (true) {
  const page = await api.query.evidence.evidenceByNs.entriesPaged({
    args: [nsBytes, subjectId],
    pageSize,
    startKey: startKey ? startKey : undefined,
  });
  if (page.length === 0) break;
  for (const [storageKey, _unit] of page) {
    const [, , id] = storageKey.args as unknown as [[u8;8], u64, u64];
    // 收集 id
  }
  startKey = page[page.length - 1][0].toHex();
}

// 按 domain/target 分页读取同理：api.query.evidence.evidenceByTarget.entriesPaged({ args:[domain, targetId], ... })
```

注意：
- `entriesPaged` 在大数据场景下更稳健；
- 返回键序递增，可作为游标；
- 仍建议后续补充 Runtime API 以屏蔽底层存储细节（P1/B）。


