# pallet-memo-ipfs

## 💰 三重扣款机制（v3.0）

**核心特性**：初次 pin 请求使用三重扣款，优先使用公共费用池，其次逝者专属资金，最后调用者自费；周期扣款使用双重扣款

### 扣款优先级

#### 初次 Pin 请求（三重扣款）

```
request_pin_for_deceased(subject_id, ...)
    ↓
1️⃣ 优先从 IpfsPoolAccount 扣款（配额限制）
    ├─ 检查月度配额：100 MEMO/deceased
    ├─ 检查池余额是否充足
    └─ ✅ 成功 → 转到 OperatorEscrowAccount
         ↓ ❌ 失败
2️⃣ 从 SubjectFunding 扣款
    ├─ 派生账户：(creator, deceased_id)
    └─ ✅ 成功 → 转到 OperatorEscrowAccount
         ↓ ❌ 失败
3️⃣ 从调用者账户扣款（fallback，自费）
    ├─ 调用者账户：msg.sender
    └─ ✅ 成功 → 转到 OperatorEscrowAccount
         ↓ ❌ 失败
4️⃣ 返回 Error::AllThreeAccountsInsufficientBalance
```

#### 周期扣款（双重扣款）

```
charge_due() / on_initialize
    ↓
1️⃣ 优先从 IpfsPoolAccount 扣款（配额限制）
    └─ ✅ 成功 → 转到 OperatorEscrowAccount
         ↓ ❌ 失败
2️⃣ 从 SubjectFunding 扣款
    └─ ✅ 成功 → 转到 OperatorEscrowAccount
         ↓ ❌ 失败
3️⃣ 进入宽限期（Grace）或标记过期（Expired）
```

**注意**：周期扣款不使用调用者 fallback，因为没有调用者上下文

### 账户说明

| 账户 | PalletId/派生规则 | 用途 | 地址示例 |
|------|------------------|------|---------|
| **IpfsPoolAccount** | `py/ipfs+` | 公共费用池，由供奉路由分配 50% | `5Fm7k7uj...` |
| **SubjectFunding** | `(domain, creator, deceased_id)` | 逝者专属资金，家属充值 | 派生地址 |
| **Caller** | msg.sender | 调用者账户，fallback 自费 | 用户地址 |
| **OperatorEscrowAccount** | `py/opesc` | 运营者托管，待 SLA 考核分配 | `5EYa...` |

### 配额规则

| 项目 | 配置值 | 说明 |
|------|--------|------|
| 月度配额 | 100 MEMO | 每个 deceased 每月的免费额度 |
| 重置周期 | 28 天 | 约 403,200 区块 |
| 计算方式 | 累计扣费 | 按实际扣费金额累计 |

### 使用示例

**示例 1：配额内使用（免费）**

```rust
// deceased_id = 1
// 本月已用配额：0 MEMO
// 本次费用：50 MEMO
// IpfsPoolAccount 余额：1000 MEMO

request_pin_for_deceased(1, cid_hash, 5000, 3, 50 * UNIT)
// ✅ 从 IpfsPoolAccount 扣款 50 MEMO
// ✅ 转到 OperatorEscrowAccount
// 剩余配额：50 MEMO
```

**示例 2：超出配额，使用专属资金**

```rust
// deceased_id = 1
// 本月已用配额：95 MEMO
// 本次费用：50 MEMO
// 配额剩余：5 MEMO < 50 MEMO
// SubjectFunding 余额：100 MEMO

request_pin_for_deceased(1, cid_hash, 5000, 3, 50 * UNIT)
// ❌ 配额不足
// ✅ 从 SubjectFunding 扣款 50 MEMO
// ✅ 转到 OperatorEscrowAccount
```

**示例 3：新用户，直接自费（友好）**

```rust
// IpfsPoolAccount 余额：0 MEMO（新链）
// SubjectFunding 余额：0 MEMO（未充值）
// Caller 余额：200 MEMO

request_pin_for_deceased(1, cid_hash, 5000, 3, 50 * UNIT)
// ❌ IpfsPoolAccount 不足
// ❌ SubjectFunding 不足
// ✅ 从 Caller 扣款 50 MEMO（自费）
// ✅ 转到 OperatorEscrowAccount
// 💡 前端提示：建议充值到 SubjectFunding 享受配额优惠
```

**示例 4：三账户都不足（失败）**

```rust
// IpfsPoolAccount 余额：0 MEMO
// SubjectFunding 余额：0 MEMO
// Caller 余额：10 MEMO < 50 MEMO

request_pin_for_deceased(1, cid_hash, 5000, 3, 50 * UNIT)
// ❌ Error::AllThreeAccountsInsufficientBalance
```

### 资金流向

```
供奉收入 → DecentralizedStorageAccount
    ↓（每 7 天分配 50%）
IpfsPoolAccount
    ↓（pin 服务扣款，配额限制）
OperatorEscrowAccount（托管）
    ↓（SLA 考核后分配）
运营者 A/B/C

或

用户充值 → SubjectFunding
    ↓（pin 服务扣款）
OperatorEscrowAccount（托管）
    ↓（SLA 考核后分配）
运营者 A/B/C

或

Caller（自费） → OperatorEscrowAccount（托管）
    ↓（SLA 考核后分配）
运营者 A/B/C
```

---

## 存储业务与 Offchain Worker（OCW）骨架

- 用户通过 `request_pin_for_deceased` 发起 pin 请求，使用三重扣款机制（IpfsPool → SubjectFunding → Caller）
- 周期扣款使用双重扣款机制（IpfsPool → SubjectFunding），无 caller fallback
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
7) 轻量事件上报：在不提交链上写交易的前提下，OCW 统计 pinning/pinned/missing 样本并发出 `PinProbe` 事件，前端/索引可据此绘制健康度。

## 计费生命周期（新增）

设计目标：上传与计费解耦；以链上请求为付费起点；从"主体派生资金账户"自动扣费，事件可审计、治理可控。

### 主题资金账户架构

**独立 PalletId 设计：**
- 使用专属的 `SubjectPalletId (*b"subjects")` 派生主题资金子账户
- 与 OTC 托管（`EscrowPalletId`）、联盟计酬（`AffiliatePalletId`）完全隔离
- 语义清晰，职责单一，易于扩展

**账户派生方式：**
- **派生公式**：`subject_account = SubjectPalletId.into_sub_account_truncating((domain:u8, subject_id:u64))`
- **逝者账户**：`domain=1`，例如 `(1, 1)` 表示逝者1的资金账户
- **墓地账户**：`domain=2`（未来扩展）
- **陵园账户**：`domain=3`（未来扩展）
- **特性**：派生账户无私钥，不可签名，仅用于托管与扣费

**架构优势：**
- ✅ **语义清晰**：`SubjectPalletId` 专门用于主题资金，不与其他业务混淆
- ✅ **职责单一**：每个域的资金独立管理，各司其职
- ✅ **资金隔离**：每个主题都有独立的资金账户，天然隔离
- ✅ **易于扩展**：可以轻松添加新的业务域（墓地、陵园等）

**使用流程：**
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
- `PinProbe(sample, pinning, pinned, missing)`：OCW 巡检周期性只读上报，样本总数与各状态计数，用于监控与告警。

### 扣费计算
`amount = ceil(size_bytes / GiB) * replicas * PricePerGiBWeek`。为避免小数，建议使用整数定价基数。

### 新增接口
- `request_pin_for_deceased(subject_id, cid_hash, size_bytes, replicas, price)`：从主体资金账户一次性扣除请求价，并初始化计费（登记 `PinSubjectOf`、`PinBilling`、入队 `DueQueue`）。
- `charge_due(limit)`【治理/白名单】：处理当前区块到期的 ≤limit 个 CID，完成扣费/宽限/过期处理，并事件记录。
- `set_billing_params(price_per_gib_week?, period_blocks?, grace_blocks?, max_charge_per_block?, subject_min_reserve?, paused?, allow_direct_pin?)`：治理更新参数（可部分更新）。当 `allow_direct_pin=false` 时，`request_pin` 将被拒绝，仅允许主体聚合扣费路径。

#### 只读视图函数（新增）
- `derive_subject_account_for_deceased(subject_id: u64) -> AccountId`：返回稳定派生的逝者主题资金账户地址。
- `derive_subject_account(domain: u8, subject_id: u64) -> AccountId`：返回任意 `(domain, subject_id)` 的主题资金账户地址。

**前端集成示例（TypeScript）：**

```typescript
import { encodeAddress, blake2AsU8a } from '@polkadot/util-crypto';
import { stringToU8a, u8aConcat } from '@polkadot/util';

/**
 * 派生主题资金子账户地址
 * @param palletId - PalletId 字符串（8字节）'subjects'
 * @param domain - 域编码（u8）1=逝者, 2=墓地, 3=陵园
 * @param subjectId - 主题ID（u64）
 * @returns 派生的账户地址
 */
function deriveSubjectAccount(palletId: string, domain: number, subjectId: number): string {
    // 1. PalletId 前缀：'modl' + palletId (padded to 8 bytes)
    const palletIdBytes = stringToU8a('modl' + palletId.padEnd(8, '\0'));
    
    // 2. Domain (u8)
    const domainBytes = new Uint8Array([domain]);
    
    // 3. SubjectId (u64, little-endian)
    const subjectIdBytes = new Uint8Array(8);
    new DataView(subjectIdBytes.buffer).setBigUint64(0, BigInt(subjectId), true);
    
    // 4. 拼接并哈希
    const combined = u8aConcat(palletIdBytes, domainBytes, subjectIdBytes);
    const hash = blake2AsU8a(combined, 256);
    
    // 5. 编码为 SS58 地址
    return encodeAddress(hash, 42);
}

// 便捷函数：派生逝者资金账户
function deriveDeceasedFundingAccount(subjectId: number): string {
    return deriveSubjectAccount('subjects', 1, subjectId);
}

// 使用示例
const address = deriveDeceasedFundingAccount(1); // 逝者1的资金账户
console.log('逝者1资金账户:', address);

// 查询余额
const { data } = await api.query.system.account(address);
const balance = data.free;

// 充值到逝者资金账户
await api.tx.balances.transferKeepAlive(address, amount).signAndSend(signer);
```

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
