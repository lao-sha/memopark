# Stardust 押金机制快速参考

**日期**: 2025-11-19  
**用途**: 开发和集成时快速查询押金配置

---

## 📋 押金配置速查表

| # | 模块 | 押金类型 | 基础金额 | 变量部分 | 配置常量 | 状态 |
|---|------|---------|---------|---------|---------|------|
| 1 | **Deceased** | 文本内容 | 10 DUST | 0.001 DUST/字节 | `TextBaseDeposit`, `TextByteDeposit` | ✅ |
| 2 | | 分类变更 | 10 DUST | - | `CategoryChangeDeposit` | ✅ |
| 3 | | 永久质押 | 待定 | 待定 | `PermanentLockBaseAmount` | ⏳ |
| 4 | **IPFS** | Pin押金 | 待定 | 按大小 | `PinBaseDeposit`, `PinPerMbDeposit` | ⏳ |
| 5 | | 运营者质押 | 待定 | - | `OperatorMinBond` | ⏳ |
| 6 | **Appeals** | 申诉押金 | 10 DUST | 1.0x-3.0x | `AppealDeposit`, `AppealDepositPolicy` | ✅ |
| 7 | **Identity** | 身份注册 | 10 DUST | 0.001 DUST/字节 | `BasicDeposit`, `ByteDeposit` | ✅ |
| 8 | | 用户名 | 5 DUST | - | `UsernameDeposit` | ✅ |
| 9 | | 子账户 | 2 DUST | 每个 | `SubAccountDeposit` | ✅ |
| 10 | **Proxy** | 代理 | 5 DUST | 1 DUST/个 | `ProxyDepositBase`, `ProxyDepositFactor` | ✅ |
| 11 | | 公告 | 2 DUST | 0.5 DUST/个 | `AnnouncementDepositBase`, `AnnouncementDepositFactor` | ✅ |
| 12 | **Multisig** | 多签 | 10 DUST | 1 DUST/签名者 | `DepositBase`, `DepositFactor` | ✅ |
| 13 | **Democracy** | 提案 | 100 DUST | - | `MinimumDeposit` | ✅ |
| 14 | **Bounties** | 赏金 | 20 DUST | 0.001 DUST/字节 | `BountyDepositBase`, `DataDepositPerByte` | ✅ |
| 15 | | 策展人 | 5-100 DUST | - | `CuratorDepositMin`, `CuratorDepositMax` | ✅ |
| 16 | **Tips** | 打赏报告 | 1 DUST | 0.001 DUST/字节 | `TipReportDepositBase`, `DataDepositPerByte` | ✅ |
| 17 | **Arbitration** | 纠纷押金 | 订单15% | 双向 | `DepositRatioBps` (1500) | ✅ |
| 18 | **Credit** | 做市商保证金 | 动态 | 信用评分 | `MakerDynamicDeposit` | ✅ |
| 19 | **NFTs** | Collection | 待定 | - | `CollectionDeposit` | ⏳ |
| 20 | | Item | 待定 | - | `ItemDeposit` | ⏳ |
| 21 | | 元数据 | 待定 | 按字节 | `MetadataDepositBase`, `MetadataDepositPerByte` | ⏳ |
| 22 | | 属性 | 待定 | - | `AttributeDepositBase` | ⏳ |
| 23 | **Recovery** | 配置 | 待定 | 每个好友 | `ConfigDepositBase`, `FriendDepositFactor` | ⏳ |
| 24 | | 恢复 | 待定 | - | `RecoveryDeposit` | ⏳ |

**图例**：
- ✅ 已配置
- ⏳ 待定义
- 📊 动态计算

---

## 💡 押金计算公式

### 固定押金

```rust
// 简单固定金额
deposit = BASE_DEPOSIT

// 示例
democracy_proposal = 100 DUST
identity_username = 5 DUST
```

### 线性押金

```rust
// 基础 + 按数量
deposit = BASE + (COUNT * FACTOR)

// 示例
proxy_deposit = 5 DUST + (proxy_count * 1 DUST)
multisig_deposit = 10 DUST + (threshold * 1 DUST)
```

### 按字节押金

```rust
// 基础 + 按大小
deposit = BASE + (SIZE_BYTES * PER_BYTE)

// 示例
text_deposit = 10 DUST + (content_size * 0.001 DUST)
identity_deposit = 10 DUST + (info_size * 0.001 DUST)
```

### 比例押金

```rust
// 按订单金额比例
deposit = ORDER_AMOUNT * RATIO

// 示例
arbitration_deposit = order_amount * 15%
```

### 动态押金

```rust
// 基于信用评分
if credit_score >= 90:
    deposit = BASE * 0.5
elif credit_score >= 70:
    deposit = BASE * 0.8
else:
    deposit = BASE * 1.2

// 示例
maker_deposit = base_deposit * credit_multiplier
```

---

## 🔄 押金处理规则

| 结果 | 退还比例 | 罚没比例 | 罚没去向 | 示例模块 |
|------|---------|---------|---------|---------|
| **成功/批准** | 100% | 0% | - | 大部分模块 |
| **取消/删除** | 100% | 0% | - | Deceased, Identity |
| **拒绝** | 50% | 50% | 国库 | Deceased分类变更 |
| **拒绝** | 70% | 30% | 国库 | Appeals申诉 |
| **撤回** | 90% | 10% | 国库 | Appeals撤回 |
| **驳回** | 70% | 30% | 国库 | Arbitration驳回 |
| **不通过** | 0% | 100% | 国库 | Democracy提案 |
| **永久质押** | 0% | 0% | 锁定 | Deceased永久保存 |

---

## 📊 按金额排序

| 金额 | 模块 | 押金类型 | 用途 |
|------|------|---------|------|
| **1 DUST** | Tips | 打赏报告 | 轻量级 |
| **2 DUST** | Proxy | 公告基础 | 轻量级 |
| **2 DUST** | Identity | 子账户 | 轻量级 |
| **5 DUST** | Identity | 用户名 | 中等 |
| **5 DUST** | Proxy | 代理基础 | 中等 |
| **5 DUST** | Bounties | 策展人最小 | 中等 |
| **10 DUST** | Deceased | 文本/分类 | 重要 |
| **10 DUST** | Identity | 身份基础 | 重要 |
| **10 DUST** | Appeals | 申诉基础 | 重要 |
| **10 DUST** | Multisig | 多签基础 | 重要 |
| **20 DUST** | Bounties | 赏金基础 | 重要 |
| **100 DUST** | Democracy | 提案 | 治理 |
| **100 DUST** | Bounties | 策展人最大 | 治理 |
| **订单15%** | Arbitration | 纠纷双向 | 动态 |
| **动态** | Credit | 做市商 | 动态 |

---

## 🎯 使用场景快速索引

### 内容创建
- 文本内容：10 DUST + 按字节
- 媒体内容：10 DUST + 按字节
- AI作品：10 DUST + 按字节
- 永久保存：待定

### 身份管理
- 注册身份：10 DUST + 按字节
- 设置用户名：5 DUST
- 添加子账户：2 DUST/个

### 权限管理
- 添加代理：5 DUST + 1 DUST/个
- 代理公告：2 DUST + 0.5 DUST/个
- 多签账户：10 DUST + 1 DUST/签名者

### 治理参与
- 发起提案：100 DUST
- 创建赏金：20 DUST + 按字节
- 策展人：5-100 DUST
- 打赏提名：1 DUST + 按字节

### 申诉和仲裁
- 内容申诉：10 DUST × 倍数（1.0-3.0）
- 发起纠纷：订单金额 × 15%
- 应诉押金：订单金额 × 15%

### 存储服务
- Pin CID：待定
- 运营者质押：待定

### 资产管理
- NFT集合：待定
- NFT铸造：待定
- NFT元数据：待定

### 账户恢复
- 社交恢复配置：待定
- 发起恢复：待定

---

## ⚠️ 重要提醒

### 开发者

1. **新增功能检查**
   - [ ] 是否占用链上存储？
   - [ ] 是否可能被滥用？
   - [ ] 押金金额是否合理？
   - [ ] 退还/罚没规则是否明确？

2. **实现要点**
   ```rust
   // 1. 冻结押金
   T::Currency::reserve(&who, deposit)?;
   
   // 2. 全额退还
   T::Currency::unreserve(&who, deposit);
   
   // 3. 部分罚没
   let slash = deposit * ratio / 100;
   T::Currency::slash_reserved(&who, slash);
   T::Currency::unreserve(&who, deposit - slash);
   ```

3. **测试覆盖**
   - [ ] 押金计算正确性
   - [ ] 余额不足处理
   - [ ] 退还逻辑
   - [ ] 罚没逻辑
   - [ ] 边界情况

### 用户

1. **押金会何时退还？**
   - ✅ 操作完成/取消
   - ✅ 内容删除
   - ✅ 申诉批准
   - ✅ 纠纷胜诉

2. **押金何时被罚没？**
   - ❌ 违规内容
   - ❌ 恶意申诉
   - ❌ 纠纷败诉
   - ❌ 提案不通过

3. **如何查看押金？**
   ```javascript
   // 查询账户冻结余额
   const reserved = await api.query.system.account(address);
   console.log('Frozen:', reserved.data.frozen.toString());
   ```

---

## 🔧 Runtime配置参考

### 标准配置模板

```rust
// runtime/src/configs/mod.rs

// === Deceased ===
parameter_types! {
    pub const TextBaseDeposit: Balance = 10 * DUST;
    pub const TextByteDeposit: Balance = 1 * MILLIDUST;
    pub const CategoryChangeDeposit: Balance = 10 * DUST;
}

// === Identity ===
parameter_types! {
    pub const BasicDeposit: Balance = 10 * DUST;
    pub const ByteDeposit: Balance = 1 * MILLIDUST;
    pub const UsernameDeposit: Balance = 5 * DUST;
    pub const SubAccountDeposit: Balance = 2 * DUST;
}

// === Proxy ===
parameter_types! {
    pub const ProxyDepositBase: Balance = 5 * DUST;
    pub const ProxyDepositFactor: Balance = 1 * DUST;
    pub const AnnouncementDepositBase: Balance = 2 * DUST;
    pub const AnnouncementDepositFactor: Balance = 500 * MILLIDUST;
}

// === Multisig ===
parameter_types! {
    pub const DepositBase: Balance = 10 * DUST;
    pub const DepositFactor: Balance = 1 * DUST;
}

// === Democracy ===
parameter_types! {
    pub const MinimumDeposit: Balance = 100 * DUST;
}

// === Bounties ===
parameter_types! {
    pub const BountyDepositBase: Balance = 20 * DUST;
    pub const DataDepositPerByte: Balance = 1 * MILLIDUST;
    pub const CuratorDepositMin: Balance = 5 * DUST;
    pub const CuratorDepositMax: Balance = 100 * DUST;
}

// === Tips ===
parameter_types! {
    pub const TipReportDepositBase: Balance = 1 * DUST;
    pub const TipDataDepositPerByte: Balance = 1 * MILLIDUST;
}

// === Arbitration ===
parameter_types! {
    pub const DepositRatioBps: u16 = 1500;  // 15%
    pub const DismissSlashBps: u16 = 3000;  // 30%
}
```

---

## 📖 相关文档

- `DEPOSIT_MECHANISMS_SUMMARY.md` - 详细说明文档
- 各模块的 `README.md` - 模块特定文档

---

**快速参考：13个模块，24种押金类型，覆盖内容、身份、治理、交易、资产等场景。** ✅
