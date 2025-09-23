## pallet-evidence 说明（v0.3）

本 pallet 用于登记与链接跨域“证据”条目，支持两类模式并存：

- V1：按 `(domain:u8, target_id:u64)` 存储明文 CID 列表（imgs/vids/docs）。
- V2：按 `(ns:[u8;8], subject_id:u64)` 存储承诺哈希 `commit:H256`（不落明文）。

### 新增能力

- 只读分页：`list_ids_by_target` / `list_ids_by_ns`，并提供 `count_by_*`；
- 配额与限频：`MaxPerSubjectTarget/MaxPerSubjectNs`、`WindowBlocks/MaxPerWindow`；
- 可选全局去重：Plain 路径启用 `CidHashIndex`（`EnableGlobalCidDedup=true` 时）。

### 常量与配置

- `MaxCidLen/MaxImg/MaxVid/MaxDoc/MaxMemoLen`：CID 长度与数量上限。
- `EvidenceNsBytes: [u8;8]`：默认命名空间（用于 V1 提交）。
- `Authorizer`：运行时适配器，校验 `(ns, who)` 是否有权限。
- `MaxPerSubjectTarget / MaxPerSubjectNs`：每主体最大证据条数（提交维度）。
- `WindowBlocks / MaxPerWindow`：账号限频窗口与上限。
- `EnableGlobalCidDedup`：是否启用 Plain 模式全局 CID 去重（默认 false）。
- `MaxListLen`：只读分页返回上限。

### Extrinsics（摘）

- `commit(domain, target_id, imgs, vids, docs, memo)`：V1 提交明文 CID 列表。
  - 校验：CID 格式、重复、数量上限、（可选）全局去重。
  - 配额：检查 `(domain,target)` 提交计数与账号限频。
  - 授权：使用 `EvidenceNsBytes` 与 `who` 进行鉴权。

- `commit_hash(ns, subject_id, commit, memo)`：V2 提交承诺哈希。
  - 防重：`CommitIndex` 确保唯一。
  - 配额：检查 `(ns,subject)` 提交计数与账号限频。
  - 授权：基于入参 `ns`。

### 错误与事件补充

- Error：`RateLimited` / `TooManyForSubject` / `DuplicateCidGlobal`。
- Event：`EvidenceThrottled(who, reason)` / `EvidenceQuotaReached(kind, subject)`。

### 设计说明

- 去重：V2 通过 CommitIndex 全局去重；Plain 可选开启 CidHashIndex。
- 配额与限频：提交前先 touch 窗口并检查主体配额；链接/取消链接不改变计数。

### 前端集成建议（移动端优先）

- 默认使用 V2 在前端持有明文，链上只存 commit；公开检索时可用 V1。
- 展示剩余额度与限频提示；分页读取使用链上只读接口或 storage entriesPaged。