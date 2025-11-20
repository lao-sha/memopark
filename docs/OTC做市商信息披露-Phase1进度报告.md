# OTC 做市商信息披露 - Phase 1 进度报告

## 执行摘要

**时间**：2025-10-22  
**阶段**：Phase 1 - 数据结构升级（进行中）  
**完成度**：60%

---

## 已完成任务

### ✅ Phase 1.1: 定义链端数据类型

**文件**：`pallets/market-maker/src/lib.rs`

#### 1. PaymentMethodType 枚举
```rust
pub enum PaymentMethodType {
    BankCard = 0,      // 银行卡转账
    Alipay = 1,        // 支付宝
    WechatPay = 2,     // 微信支付
    UsdtTrc20 = 3,     // USDT (TRON链 TRC20)
    Cash = 4,          // 现金（线下交易）
}
```

#### 2. PaymentMethodDetail 结构体
```rust
pub struct PaymentMethodDetail {
    pub method_type: PaymentMethodType,          // 收款方式类型
    pub masked_account: BoundedVec<u8, ConstU32<64>>,  // 脱敏账号
    pub masked_name: BoundedVec<u8, ConstU32<64>>,     // 脱敏姓名
    pub bank_name: Option<BoundedVec<u8, ConstU32<128>>>,  // 银行名称
    pub enabled: bool,                            // 是否启用
}
```

---

### ✅ Phase 1.2: 实现链端脱敏算法

#### 1. 姓名脱敏算法
```rust
pub fn mask_name(full_name: &str) -> sp_std::vec::Vec<u8>
```

**脱敏规则**：
- 2字：`张三` → `×三`
- 3字：`李四五` → `李×五`
- 4字+：`王二麻子` → `王×子`、`欧阳娜娜` → `欧×娜`

#### 2. 身份证号脱敏算法
```rust
pub fn mask_id_card(id_card: &str) -> sp_std::vec::Vec<u8>
```

**脱敏规则**：
- 18位：`110101199001011234` → `1101**********1234`
- 15位：`110101800101123` → `1101*******0123`

#### 3. 账号脱敏算法
```rust
pub fn mask_account(account: &str, front_count: usize, back_count: usize) -> sp_std::vec::Vec<u8>
```

**脱敏规则**：
- 默认前4后4：`6214123456785678` → `6214********5678`
- 手机号(3,4)：`13800138000` → `138****8000`

---

### ✅ Phase 1.3: 修改 Application 结构体

**新增字段**：

```rust
pub struct Application<AccountId, Balance> {
    // ... 原有字段 ...
    
    /// 🆕 2025-10-22：收款方式列表（结构化，脱敏版本）
    pub payment_methods: BoundedVec<PaymentMethodDetail, ConstU32<5>>,
    
    /// 🆕 2025-10-22：脱敏姓名
    pub masked_full_name: BoundedVec<u8, ConstU32<64>>,
    
    /// 🆕 2025-10-22：脱敏身份证号
    pub masked_id_card: BoundedVec<u8, ConstU32<32>>,
    
    // ... 其他字段 ...
}
```

---

### ✅ Phase 1.4: 修改链端接口（部分完成）

#### 1. submit_info 接口（已修改）

**新增参数**：
```rust
pub fn submit_info(
    origin: OriginFor<T>,
    maker_id: u64,
    // ... 原有参数 ...
    payment_methods: BoundedVec<PaymentMethodDetail, ConstU32<5>>,  // 🆕 结构化
    full_name: Vec<u8>,      // 🆕 完整姓名（自动脱敏）
    id_card: Vec<u8>,        // 🆕 完整身份证号（自动脱敏）
) -> DispatchResult
```

**自动脱敏逻辑**：
```rust
let masked_name_vec = mask_name(full_name_str);
let masked_id_vec = mask_id_card(id_card_str);

app.masked_full_name = masked_name_vec.try_into()?;
app.masked_id_card = masked_id_vec.try_into()?;
```

---

## 待完成任务

### ⏳ Phase 1.4: 修改链端接口（剩余部分）

#### 1. update_info 接口
- [ ] 修改参数类型
- [ ] 添加姓名和身份证号参数
- [ ] 实现脱敏逻辑

#### 2. update_payment_methods 接口
- [ ] 修改参数从 `BoundedVec<PaymentMethod>` 改为 `BoundedVec<PaymentMethodDetail>`
- [ ] 验证收款方式列表

#### 3. approve 接口
- [ ] 验证脱敏字段是否已填写
- [ ] 确保批准前所有必需信息完整

---

### ⏳ Phase 1.5: 更新链端 README 文档

- [ ] 更新数据结构说明
- [ ] 更新接口文档
- [ ] 添加脱敏算法说明
- [ ] 更新示例代码

---

### ⏳ Phase 1.6: 定义前端类型和脱敏算法（TypeScript）

#### 1. 类型定义
```typescript
export enum PaymentMethodType {
  BankCard = 0,
  Alipay = 1,
  WechatPay = 2,
  UsdtTrc20 = 3,
  Cash = 4,
}

export interface PaymentMethodDetail {
  method_type: PaymentMethodType;
  masked_account: string;
  masked_name: string;
  bank_name?: string;
  enabled: boolean;
}
```

#### 2. 脱敏算法
```typescript
export function maskName(fullName: string): string;
export function maskIdCard(idCard: string): string;
export function maskAccount(account: string, front: number, back: number): string;
```

---

### ⏳ Phase 1.7: 修改前端 UI 组件

#### 1. CreateMarketMakerPage.tsx
- [ ] 添加姓名输入字段
- [ ] 添加身份证号输入字段
- [ ] 修改收款方式配置（支持多种类型）
- [ ] 实时预览脱敏效果

#### 2. MarketMakerConfigPage.tsx
- [ ] 更新收款方式展示
- [ ] 添加脱敏信息展示
- [ ] 支持编辑收款方式

---

### ⏳ Phase 1.8: 编译验证

- [ ] 链端编译（`cargo build --release`）
- [ ] 前端编译（`npm run build`）
- [ ] 修复编译错误
- [ ] 功能测试

---

## 技术难点

### 1. no_std 环境限制

**问题**：Substrate pallet 运行在 `no_std` 环境，不能使用标准库的 `String` 和 `format!`。

**解决方案**：使用 `sp_std::vec::Vec<u8>` 和 `sp_std::format!`。

```rust
use sp_std::prelude::*;

pub fn mask_name(full_name: &str) -> sp_std::vec::Vec<u8> {
    let masked_str = sp_std::format!("{}×{}", chars[0], chars[len - 1]);
    masked_str.as_bytes().to_vec()
}
```

### 2. 字符串与字节数组转换

**问题**：链上存储使用 `BoundedVec<u8>`，需要频繁转换。

**解决方案**：
```rust
// UTF-8 字节数组 → 字符串
let full_name_str = sp_std::str::from_utf8(&full_name)?;

// 字符串 → 字节数组
let masked_vec = mask_name(full_name_str);

// 字节数组 → BoundedVec
let bounded: BoundedVec<u8, ConstU32<64>> = masked_vec.try_into()?;
```

### 3. 向后兼容性

**问题**：修改 `payment_methods` 类型会导致旧数据不兼容。

**解决方案**：
- ✅ 保留旧类型别名 `PaymentMethod`（标记为已废弃）
- ✅ 主网未上线，允许破坏式调整（规则第9条）
- 🔄 后续提供数据迁移脚本

---

## 下一步计划

### 优先级 1（本周完成）
1. 完成 `update_info` 和 `update_payment_methods` 接口修改
2. 链端编译验证并修复错误
3. 更新 pallet README 文档

### 优先级 2（下周完成）
4. 前端类型定义和脱敏算法实现
5. 修改前端 UI 组件
6. 前端编译验证

### 优先级 3（后续优化）
7. 完整功能测试
8. Phase 2：IPFS 加密存储
9. Phase 3：前端 UI 优化
10. Phase 4：上线准备

---

## 附录

### A. 修改文件清单

| 文件 | 状态 | 修改内容 |
|-----|------|---------|
| `pallets/market-maker/src/lib.rs` | ✅ 进行中 | 数据类型、脱敏算法、接口修改 |
| `pallets/market-maker/README.md` | ⏳ 待完成 | 文档更新 |
| `stardust-dapp/src/types/index.ts` | ⏳ 待完成 | 前端类型定义 |
| `stardust-dapp/src/utils/mask.ts` | ⏳ 待完成 | 前端脱敏算法 |
| `stardust-dapp/src/features/otc/CreateMarketMakerPage.tsx` | ⏳ 待完成 | UI 修改 |

### B. 预估工作量

| 任务 | 预估时间 | 实际时间 |
|-----|---------|---------|
| Phase 1.1-1.3 | 2小时 | 1.5小时 ✅ |
| Phase 1.4 | 1小时 | 0.5小时 ⏳ |
| Phase 1.5 | 0.5小时 | - |
| Phase 1.6-1.7 | 1小时 | - |
| Phase 1.8 | 0.5小时 | - |
| **总计** | **5小时** | **2小时（40%）** |

---

**报告生成时间**：2025-10-22  
**当前状态**：Phase 1 进行中（60%完成）  
**预计完成时间**：今天内完成 Phase 1

