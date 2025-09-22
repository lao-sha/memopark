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

## 计费生命周期（新增）

设计目标：上传与计费解耦；以链上请求为付费起点；从“主体派生资金账户”自动扣费，事件可审计、治理可控。

- 主体资金账户：`subject_account = SubjectPalletId.into_sub_account_truncating((owner, subject_id))`（不可签名，仅托管/扣费）。
- 两步法：用户先向主体资金账户充值；再调用 `request_pin_for_deceased(subject_id, ...)` 固化进入生命周期。
- 周期扣费：按周（可配置）从主体账户扣 MEMO，失败进入宽限，超期过期。

### 新增存储
- `PricePerGiBWeek: u128`：每 GiB·周 单价（最小单位）。
- `BillingPeriodBlocks: u32`：计费周期区块数（默认 100_800 ≈ 1 周）。
- `GraceBlocks: u32`：宽限期区块数。
- `MaxChargePerBlock: u32`：每块最大扣费数（限流）。
- `SubjectMinReserve: Balance`：主体账户最低保留（KeepAlive 保护）。
- `BillingPaused: bool`：计费暂停开关。
- `PinBilling{cid_hash -> (next_charge_at, unit_price_snapshot, state)}`：state=0 Active/1 Grace/2 Expired。
- `PinSubjectOf{cid_hash -> (owner, subject_id)}`：仅“主体扣费”场景登记来源。
- `DueQueue{block -> Vec<cid_hash>}`：到期队列（每块处理上限）。
  - `DueEnqueueSpread: u32`：入队扩散窗口；将到期项在 `base..base+spread` 范围内寻找首个未满队列入队，以平滑负载。

### 新增事件
- `PinCharged(cid_hash, amount, period_blocks, next_charge_at)`：成功扣费并推进下一期。
- `PinGrace(cid_hash)`：余额不足进入宽限。
- `PinExpired(cid_hash)`：超出宽限仍不足，标记过期。

### 扣费计算
`amount = ceil(size_bytes / GiB) * replicas * PricePerGiBWeek`。为避免小数，建议使用整数定价基数。

### 新增接口
- `request_pin_for_deceased(subject_id, cid_hash, size_bytes, replicas, price)`：从主体资金账户一次性扣除请求价，并初始化计费（登记 `PinSubjectOf`、`PinBilling`、入队 `DueQueue`）。
- `charge_due(limit)`【治理/白名单】：处理当前区块到期的 ≤limit 个 CID，完成扣费/宽限/过期处理，并事件记录。
- `set_billing_params(price_per_gib_week?, period_blocks?, grace_blocks?, max_charge_per_block?, subject_min_reserve?, paused?)`：治理更新参数（可部分更新）。

#### 只读查询（前端建议直读）
- `PinBilling{cid_hash}` → `(next_charge_at, unit_price_snapshot, state)`：state=0 Active/1 Grace/2 Expired。
- `PinSubjectOf{cid_hash}` → `(owner, subject_id)`：仅“主体扣费”场景存在。
- `PinMeta{cid_hash}` → `(replicas, size_bytes, created, last_checked)`：用于估算单周成本。
- `DueQueue{block}` → `Vec<cid_hash>`：仅供运维观测与调度，不建议前端依赖。

> 参数防呆：`set_billing_params` 对 `price/period/grace/max_per_block` 做 `>0` 校验，避免设置为 0 造成停摆或无限宽限。

### 安全与治理
- 仅允许 Pallet 内从“主体派生账户”扣款；金额依据链上参数与 CID 元数据计算；转账采用 `KeepAlive` 并校验 `free - amount ≥ SubjectMinReserve`。
- 通过 `BillingPaused` 可暂停计费；参数可治理调整；白名单服务商可触发 `charge_due(limit)` 无权变更金额。

### 前端使用建议
- 两步法页面展示：主体资金账户余额、预估单周成本、下次扣费区块、当前状态（Active/Grace/Expired）。
- 支持输入 owner+subject_id 推导派生地址并一键复制；提供充值快捷入口。

## 存储（新增）
- `PinMeta{cid_hash -> (replicas, size_bytes, created, last_checked)}`
- `PinStateOf{cid_hash -> u8}`：0=Requested,1=Pinning,2=Pinned,3=Degraded,4=Failed
- `PinAssignments{cid_hash -> BoundedVec<AccountId>}`
- `PinSuccess{(cid_hash, operator) -> bool}`
- `OperatorSla{account -> {probe_ok, probe_fail, ...}}`

## 退避与锁
- 全局 `StorageLock`：`/memo/ipfs/ocw_lock`，避免并发重复 OCW 周期
- 指数退避键：`/memo/ipfs/backoff/<cid_hash>`（SCALE 编码哈希后缀），失败 2s 起指数增加，上限 60s；成功则重置
