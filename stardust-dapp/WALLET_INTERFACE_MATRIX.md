# Stardust 钱包功能接口矩阵

## 功能需求 vs 链端接口映射表

### 一、钱包基础功能

| 功能 | 所需接口 | Pallet | 查询/交易 | 权限 | 实现复杂度 |
|-----|---------|--------|----------|------|-----------|
| 显示账户地址 | N/A | N/A | N/A | - | ★☆☆☆☆ |
| 查询余额 | `system.account` | frame_system | 查询 | - | ★☆☆☆☆ |
| 显示可用余额 | `system.account` | frame_system | 查询 | - | ★☆☆☆☆ |
| 显示预留余额 | `system.account` | frame_system | 查询 | - | ★☆☆☆☆ |
| 显示冻结余额 | `system.account` + `balances.freezes` | balances | 查询 | - | ★★☆☆☆ |
| 账户 nonce | `system.account` | frame_system | 查询 | - | ★☆☆☆☆ |

---

### 二、身份管理功能

| 功能 | 所需接口 | Pallet | 查询/交易 | 权限 | 实现复杂度 |
|-----|---------|--------|----------|------|-----------|
| 显示昵称 | `identity.identityOf` | identity | 查询 | - | ★★☆☆☆ |
| 设置昵称 | `identity.setIdentity` | identity | 交易 | Signed | ★★★☆☆ |
| 编辑昵称 | `identity.setIdentity` | identity | 交易 | Signed | ★★★☆☆ |
| 清除昵称 | `identity.clearIdentity` | identity | 交易 | Signed | ★★☆☆☆ |
| 管理子账户 | `identity.setSubs` / `addSub` / `removeSub` | identity | 交易 | Signed | ★★★★☆ |
| 查看身份押金 | `identity.identityOf` | identity | 查询 | - | ★★☆☆☆ |

---

### 三、推荐码功能

| 功能 | 所需接口 | Pallet | 查询/交易 | 权限 | 实现复杂度 |
|-----|---------|--------|----------|------|-----------|
| 显示推荐码 | `affiliate.codeByAccount` | affiliate | 查询 | - | ★★☆☆☆ |
| 认领推荐码 | `affiliate.claimCode` | affiliate | 交易 | Signed | ★★★☆☆ |
| 编辑推荐码 | ❌ 不支持 | affiliate | - | - | ❌ |
| 删除推荐码 | ❌ 不支持 | affiliate | - | - | ❌ |
| 绑定推荐人 | `affiliate.bindSponsor` | affiliate | 交易 | Signed | ★★★☆☆ |
| 查看推荐人 | `affiliate.sponsors` | affiliate | 查询 | - | ★☆☆☆☆ |
| 查看活跃直推 | `affiliate.directActiveCount` | affiliate | 查询 | - | ★☆☆☆☆ |
| 应得佣金查询 | `affiliate.entitlement` | affiliate | 查询 | - | ★★☆☆☆ |

---

### 四、转账功能

| 功能 | 所需接口 | Pallet | 查询/交易 | 权限 | 实现复杂度 |
|-----|---------|--------|----------|------|-----------|
| 发起转账 | `balances.transfer` | balances | 交易 | Signed | ★★★☆☆ |
| 转账预验证 | `system.account` | frame_system | 查询 | - | ★★☆☆☆ |
| 转账确认 | `system.account` | frame_system | 查询 | - | ★★☆☆☆ |
| 转账全部余额 | `balances.transfer_all` | balances | 交易 | Signed | ★★★☆☆ |
| 保活转账 | `balances.transfer_keep_alive` | balances | 交易 | Signed | ★★★☆☆ |

---

### 五、交易历史功能

| 功能 | 所需接口 | 来源 | 查询/交易 | 权限 | 实现复杂度 |
|-----|---------|-------|----------|------|-----------|
| 本地交易记录 | `localStorage` | 前端 | 查询 | - | ★★☆☆☆ |
| 链上交易查询 | Subsquid API | ETL | 查询 | - | ★★★★☆ |
| 交易状态监听 | `system.events` | frame_system | 订阅 | - | ★★★☆☆ |

---

### 六、系统信息功能

| 功能 | 所需接口 | Pallet | 查询/交易 | 权限 | 实现复杂度 |
|-----|---------|--------|----------|------|-----------|
| 显示当前块号 | `system.number` | frame_system | 查询 | - | ★☆☆☆☆ |
| 显示链名称 | `rpc.system.chain` | RPC | 查询 | - | ★☆☆☆☆ |
| 显示节点版本 | `rpc.system.version` | RPC | 查询 | - | ★☆☆☆☆ |
| 显示 Token 信息 | API metadata | API | 查询 | - | ★☆☆☆☆ |
| 网络连接状态 | `api.isConnected` | API | 查询 | - | ★☆☆☆☆ |

---

### 七、高级功能（可选）

| 功能 | 所需接口 | Pallet | 查询/交易 | 权限 | 实现复杂度 |
|-----|---------|--------|----------|------|-----------|
| 总发行量显示 | `balances.totalIssuance` | balances | 查询 | - | ★☆☆☆☆ |
| 账户持有显示 | `balances.holds` | balances | 查询 | - | ★★☆☆☆ |
| 联盟配置查询 | `affiliate.settlementMode` 等 | affiliate | 查询 | - | ★★☆☆☆ |
| 投票参与 | `affiliate.propose_*` / `vote_on_*` | affiliate | 交易 | Signed | ★★★★★ |

---

## 按实现复杂度分类

### 最简单（★☆☆☆☆）- 可直接调用

```typescript
// 直接 API 调用，无错误处理需求
- system.account (基础字段)
- rpc.system.chain / version / name
- api.isConnected
- 显示地址（本地）
```

### 简单（★★☆☆☆）- 需要基本错误处理

```typescript
// 需要 try-catch 和数据格式转换
- system.account (完整字段)
- balances.locks / holds / freezes
- identity.identityOf (获取)
- affiliate.codeByAccount
- affiliate.sponsors
```

### 中等（★★★☆☆）- 需要验证逻辑

```typescript
// 需要前置条件检查和错误处理
- balances.transfer (转账验证)
- identity.setIdentity / clearIdentity
- affiliate.claimCode (长度/占用检查)
- affiliate.bindSponsor (循环检查)
```

### 复杂（★★★★☆）- 需要多个接口组合

```typescript
// 需要多次查询和状态同步
- 完整的转账流程（查询 → 验证 → 签名 → 监听）
- 身份管理完整流程
- Subsquid 交易历史集成
- 联盟配置和结算查询
```

### 很复杂（★★★★★）- 企业级功能

```typescript
// 需要深入理解业务逻辑
- 治理提案和投票
- 周期结算计算
- 15层压缩佣金分配
```

---

## 前端页面与接口映射

### MyWalletPage（我的钱包）

```
┌─ 显示余额
│  ├─ system.account → free
│  ├─ system.account → reserved
│  └─ system.account → frozen
│
├─ 显示昵称
│  └─ identity.identityOf → info.display
│
├─ 显示推荐码
│  └─ affiliate.codeByAccount
│
├─ 显示地址
│  └─ localStorage.currentAddress
│
└─ 系统信息
   ├─ system.number
   ├─ rpc.system.chain
   └─ api.isConnected
```

### TransferPage（转账页面）

```
┌─ 输入验证
│  ├─ 地址格式检查
│  ├─ 金额格式检查
│  └─ 金额 ≤ usableBalance 检查
│
├─ 预估费用
│  ├─ system.account → nonce
│  └─ 交易大小估计
│
├─ 执行转账
│  ├─ balances.transfer
│  ├─ 签名 (signAndSendLocalFromKeystore)
│  └─ 监听事件
│
└─ 确认成功
   └─ system.account (新余额)
```

### IdentityPage（身份管理）

```
┌─ 查看当前身份
│  └─ identity.identityOf
│
├─ 编辑昵称
│  └─ identity.setIdentity
│
├─ 设置子账户
│  └─ identity.setSubs / addSub / removeSub
│
└─ 查看押金
   └─ identity.identityOf → deposit
```

### ReferralPage（推荐管理）

```
┌─ 显示推荐码
│  └─ affiliate.codeByAccount
│
├─ 认领推荐码
│  └─ affiliate.claimCode
│
├─ 绑定推荐人
│  └─ affiliate.bindSponsor
│
├─ 查看推荐人
│  ├─ affiliate.sponsors
│  └─ identity.identityOf (推荐人昵称)
│
└─ 查看佣金
   ├─ affiliate.entitlement
   ├─ affiliate.directActiveCount
   └─ affiliate.activeUntilWeek
```

---

## 数据流向图

### 用户打开钱包 → 显示余额

```
User Opens App
    ↓
getCurrentAddress() → address
    ↓
api.query.system.account(address)
    ↓
Extract: { free, reserved, frozen, nonce }
    ↓
Calculate usable = free - max(frozen, reserved)
    ↓
Display: "可用余额: 100.123 DUST"
```

### 用户发起转账

```
User Input: dest_addr, amount
    ↓
Validate address format & amount > 0
    ↓
Query: system.account(sender)
    ↓
Check: amount ≤ usable balance
    ↓
Construct TX: balances.transfer(dest, amount)
    ↓
Sign & Send: signAndSendLocalFromKeystore(tx, password)
    ↓
Monitor: system.events for Transfer event
    ↓
Query: system.account(sender) again
    ↓
Display: "转账成功！新余额: 99.987 DUST"
```

### 用户绑定推荐人

```
User Input: sponsor_code
    ↓
Query: affiliate.accountByCode(sponsor_code)
    ↓
Validate: code exists & account is member
    ↓
Query: affiliate.sponsors(user)
    ↓
Check: already bound? → Error if true
    ↓
Construct TX: affiliate.bindSponsor(sponsor_code)
    ↓
Sign & Send: signAndSendLocalFromKeystore(tx, password)
    ↓
Monitor: SponsorBound event
    ↓
Display: "推荐人绑定成功！"
```

---

## 存储项优先级

### 高优先级（必须支持）

- `system.account` - 所有钱包功能的基础
- `balances.transfer*` - 核心转账功能
- `identity.identityOf` - 身份显示
- `affiliate.codeByAccount` - 推荐码显示
- `affiliate.bindSponsor` - 绑定功能

### 中优先级（应该支持）

- `identity.setIdentity` - 编辑身份
- `affiliate.claimCode` - 认领推荐码
- `balances.holds` / `freezes` - 详细余额显示
- `affiliate.sponsors` - 推荐人查询
- `system.number` - 块号显示

### 低优先级（可选）

- `identity.setSubs` - 子账户管理
- `affiliate.entitlement` - 佣金查询
- `affiliate.settlementMode` - 模式查询
- Subsquid 交易历史 - 完整历史

---

## API 连接检查清单

实现前必须验证：

- [ ] `api.query.system` 存在
- [ ] `api.query.balances` 存在
- [ ] `api.query.identity` 存在
- [ ] `api.query.affiliate` 存在
- [ ] `api.tx.balances.transfer` 存在
- [ ] `api.tx.identity.setIdentity` 存在
- [ ] `api.tx.affiliate.bindSponsor` 存在
- [ ] `api.rpc.system.chain()` 响应正常
- [ ] WebSocket 连接状态稳定

---

**维护者**: Stardust 开发团队  
**更新日期**: 2025-11-19
