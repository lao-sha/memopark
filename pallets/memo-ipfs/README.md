# pallet-memo-ipfs

存储业务与 Offchain Worker（OCW）骨架：

- 用户通过 `request_pin` 一次性付费，金额通过 Endowment 接口打到基金会。
- 运营者（矿工）需 `join_operator` 并质押，活跃状态方可上报；上报/探测与 SLA 统计绑定。
- OCW 调用 ipfs-cluster API 完成 `POST /pins`（携带 allocations）与后续巡检/修复；指数退避与全局锁防抖。
- OCW 使用节点 keystore 的 `KeyTypeId = b"ipfs"` 专用密钥签名上报 `mark_pinned/mark_pin_failed/report_probe`。

安全与隐私：

- 链上仅存 `cid_hash`，不存明文 CID；OCW 可从本地密文/审计密钥解密得到 CID 后再发 HTTP。
- 集群端点与令牌存于 offchain 本地存储：`/memo/ipfs/cluster_endpoint`、`/memo/ipfs/token`。

## 流程

1) 下单与记账：`request_pin(cid_hash, size, replicas, price)` → `Endowment::deposit_from_storage` 入账
2) 副本分配：OCW 为该 `cid_hash` 选取 R 个活跃运营者 → `PinAssignments`
3) 发起 Pin：OCW 发送 `POST /pins`，body 含 `{ cid, allocations: [peer_id...] }`
4) 回执上链：运营者成功/失败上报 `mark_pinned/mark_pin_failed`，写入 `PinSuccess`；达成 R 副本 → `PinState=Pinned`
5) 巡检与修复：OCW 周期遍历 `PinState in {Pinning,Pinned}`，不足副本则再次 `POST /pins`（指数退避与全局锁防抖）；后续可细化 `ReplicaDegraded/ReplicaRepaired`
6) SLA 统计：OCW 读 `/peers` 上报 `report_probe(ok)`；基金会按期 `close_epoch_and_pay(budget)` 依权重发放

## 存储（新增）
- `PinMeta{cid_hash -> (replicas, size_bytes, created, last_checked)}`
- `PinStateOf{cid_hash -> u8}`：0=Requested,1=Pinning,2=Pinned,3=Degraded,4=Failed
- `PinAssignments{cid_hash -> BoundedVec<AccountId>}`
- `PinSuccess{(cid_hash, operator) -> bool}`
- `OperatorSla{account -> {probe_ok, probe_fail, ...}}`

## 退避与锁
- 全局 `StorageLock`：`/memo/ipfs/ocw_lock`，避免并发重复 OCW 周期
- 指数退避键：`/memo/ipfs/backoff/<cid_hash>`（SCALE 编码哈希后缀），失败 2s 起指数增加，上限 60s；成功则重置
