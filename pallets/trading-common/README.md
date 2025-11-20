# Trading Common - 交易公共工具库

[![License](https://img.shields.io/badge/license-Unlicense-blue.svg)](LICENSE)
[![Substrate](https://img.shields.io/badge/Substrate-stable2409-brightgreen.svg)](https://github.com/paritytech/polkadot-sdk)

## 概述

`pallet-trading-common` 是一个纯 Rust 公共工具库，为 Stardust 区块链项目中的交易相关功能提供通用的数据处理和验证工具。该库设计为轻量级、无状态、可复用的工具集，可被多个 pallet 共享使用。

### 核心特性

- ✅ **纯工具库**：不包含链上存储，无运行时状态
- ✅ **no_std 兼容**：支持在 WebAssembly 运行时环境中使用
- ✅ **高度可复用**：可被 `pallet-otc-maker`、`pallet-otc-order` 等多个模块共享
- ✅ **数据安全**：提供完善的数据脱敏机制，保护用户隐私
- ✅ **格式验证**：内置 TRON 地址和支付配置验证逻辑

## 功能模块

### 1. 数据脱敏模块 (`mask`)

提供姓名、身份证号、生日等敏感信息的脱敏处理函数，确保链上数据符合隐私保护要求。

#### 主要函数

- **`mask_name`** - 姓名脱敏
- **`mask_id_card`** - 身份证号脱敏
- **`mask_birthday`** - 生日脱敏

### 2. 数据验证模块 (`validation`)

提供加密货币地址和第三方支付配置的格式验证，确保数据完整性。

#### 主要函数

- **`is_valid_tron_address`** - TRON 地址格式验证
- **`is_valid_epay_config`** - EPAY 支付配置验证

---

## 详细功能说明

### 数据脱敏机制

#### 1. 姓名脱敏 (`mask_name`)

根据姓名长度采用不同的脱敏策略，平衡隐私保护和可读性。

**脱敏规则：**

| 字符数 | 规则 | 示例 |
|--------|------|------|
| 0 字   | 返回空字符串 | `""` → `""` |
| 1 字   | 完全遮掩 | `"李"` → `"×"` |
| 2 字   | 前遮后留 | `"张三"` → `"×三"` |
| 3 字   | 前后保留，中间遮掩 | `"李四五"` → `"李×五"` |
| ≥4 字  | 首末保留，中间遮掩 | `"王二麻子"` → `"王×子"` |

**使用示例：**

```rust
use pallet_trading_common::mask_name;

// 不同长度的姓名脱敏
let masked1 = mask_name("李");           // "×"
let masked2 = mask_name("张三");         // "×三"
let masked3 = mask_name("李四五");       // "李×五"
let masked4 = mask_name("王二麻子");     // "王×子"

// 在 pallet 中使用
#[pallet::call]
impl<T: Config> Pallet<T> {
    pub fn store_masked_name(
        origin: OriginFor<T>,
        full_name: Vec<u8>,
    ) -> DispatchResult {
        let who = ensure_signed(origin)?;

        // 将字节数组转为字符串进行脱敏
        let name_str = sp_std::str::from_utf8(&full_name)
            .map_err(|_| Error::<T>::InvalidUtf8)?;
        let masked = mask_name(name_str);

        // 存储脱敏后的姓名
        MaskedNames::<T>::insert(&who, masked);

        Ok(())
    }
}
```

#### 2. 身份证号脱敏 (`mask_id_card`)

保留身份证号的首尾特征，隐藏中间敏感信息。

**脱敏规则：**

| 长度 | 规则 | 示例 |
|------|------|------|
| 18 位 | 前4位 + 10个星号 + 后4位 | `"110101199001011234"` → `"1101**********1234"` |
| 15 位 | 前4位 + 7个星号 + 后4位 | `"110101900101123"` → `"1101*******0123"` |
| <8 位 | 全部用星号替换 | `"1234567"` → `"*******"` |

**使用示例：**

```rust
use pallet_trading_common::mask_id_card;

// 18位身份证脱敏
let masked_18 = mask_id_card("110101199001011234");
// 结果: "1101**********1234"

// 15位身份证脱敏
let masked_15 = mask_id_card("110101900101123");
// 结果: "1101*******0123"

// 在交易验证中使用
pub fn verify_identity(id_card: &str) -> DispatchResult {
    // 验证原始身份证格式
    ensure!(id_card.len() == 18, Error::<T>::InvalidIdCard);

    // 脱敏后存储
    let masked = mask_id_card(id_card);
    log::info!("存储脱敏身份证: {:?}", masked);

    Ok(())
}
```

#### 3. 生日脱敏 (`mask_birthday`)

保留年份信息用于年龄验证，隐藏具体出生日期。

**脱敏规则：**

| 格式 | 规则 | 示例 |
|------|------|------|
| 标准格式 (YYYY-MM-DD) | 保留年份，月日用 xx 替换 | `"1990-01-01"` → `"1990-xx-xx"` |
| 少于4字符 | 完全遮掩 | `"123"` → `"****-xx-xx"` |

**使用示例：**

```rust
use pallet_trading_common::mask_birthday;

// 标准生日脱敏
let masked1 = mask_birthday("1990-01-01");  // "1990-xx-xx"
let masked2 = mask_birthday("2000-12-25");  // "2000-xx-xx"

// 异常输入处理
let masked3 = mask_birthday("123");         // "****-xx-xx"

// 在 KYC 验证中使用
pub fn submit_kyc_info(
    origin: OriginFor<T>,
    birthday: Vec<u8>,
) -> DispatchResult {
    let who = ensure_signed(origin)?;

    // 脱敏处理
    let birthday_str = sp_std::str::from_utf8(&birthday)
        .map_err(|_| Error::<T>::InvalidUtf8)?;
    let masked = mask_birthday(birthday_str);

    // 存储脱敏后的生日
    UserBirthdays::<T>::insert(&who, masked);

    Ok(())
}
```

---

### 数据验证机制

#### 1. TRON 地址验证 (`is_valid_tron_address`)

验证 TRON 区块链地址的格式正确性，确保跨链交易的安全性。

**验证规则：**

1. **长度检查**：必须为 34 字符
2. **前缀检查**：必须以 'T' 开头
3. **字符集检查**：只能包含 Base58 字符集（1-9, A-H, J-N, P-Z, a-k, m-z）

**Base58 字符集说明：**

Base58 编码排除了容易混淆的字符：
- 排除数字 `0` 和 `O`
- 排除字母 `I` 和 `l`
- 字符集：`123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz`

**使用示例：**

```rust
use pallet_trading_common::is_valid_tron_address;

// 有效地址验证
let valid_addr = b"TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS";
assert!(is_valid_tron_address(valid_addr));  // true

// 无效地址检测
let invalid_addr1 = b"TYASR5UV6HEcXatwdFQfmLVUqQQQMUxHLS";  // 35字符，长度错误
assert!(!is_valid_tron_address(invalid_addr1));  // false

let invalid_addr2 = b"AYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS";  // 不是T开头
assert!(!is_valid_tron_address(invalid_addr2));  // false

let invalid_addr3 = b"TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHL0";  // 包含0（非Base58）
assert!(!is_valid_tron_address(invalid_addr3));  // false

// 在跨链桥中使用
#[pallet::call]
impl<T: Config> Pallet<T> {
    pub fn set_tron_address(
        origin: OriginFor<T>,
        tron_address: Vec<u8>,
    ) -> DispatchResult {
        let who = ensure_signed(origin)?;

        // 验证 TRON 地址格式
        ensure!(
            is_valid_tron_address(&tron_address),
            Error::<T>::InvalidTronAddress
        );

        // 存储有效的 TRON 地址
        TronAddresses::<T>::insert(&who, tron_address);

        Self::deposit_event(Event::TronAddressSet { who });
        Ok(())
    }
}
```

#### 2. EPAY 配置验证 (`is_valid_epay_config`)

验证第三方支付平台（EPAY）配置的完整性和有效性。

**验证规则：**

| 配置状态 | epay_no | epay_key | 验证结果 |
|----------|---------|----------|----------|
| 都不配置 | None | None | ✅ 有效 |
| 完整配置 | 10-32字符 | 16-64字符 | ✅ 有效 |
| 只配置一项 | Some / None | None / Some | ❌ 无效 |
| 长度不符 | <10 或 >32 | <16 或 >64 | ❌ 无效 |

**使用示例：**

```rust
use pallet_trading_common::is_valid_epay_config;

// 场景1: 都不配置（有效）
let config1 = (None, None);
assert!(is_valid_epay_config(&config1.0, &config1.1));

// 场景2: 完整配置（有效）
let config2 = (
    Some(b"1234567890".to_vec()),           // 10字符商户号
    Some(b"1234567890123456".to_vec()),     // 16字符密钥
);
assert!(is_valid_epay_config(&config2.0, &config2.1));

// 场景3: 只配置商户号（无效）
let config3 = (Some(b"1234567890".to_vec()), None);
assert!(!is_valid_epay_config(&config3.0, &config3.1));

// 场景4: 长度不符（无效）
let config4 = (
    Some(b"123".to_vec()),      // 只有3字符，不足10
    Some(b"123".to_vec()),      // 只有3字符，不足16
);
assert!(!is_valid_epay_config(&config4.0, &config4.1));

// 在支付配置中使用
#[pallet::call]
impl<T: Config> Pallet<T> {
    pub fn configure_epay(
        origin: OriginFor<T>,
        epay_no: Option<Vec<u8>>,
        epay_key: Option<Vec<u8>>,
    ) -> DispatchResult {
        let who = ensure_signed(origin)?;

        // 验证 EPAY 配置
        ensure!(
            is_valid_epay_config(&epay_no, &epay_key),
            Error::<T>::InvalidEpayConfig
        );

        // 存储有效配置
        if let (Some(no), Some(key)) = (epay_no, epay_key) {
            EpayConfigs::<T>::insert(&who, (no, key));
            Self::deposit_event(Event::EpayConfigured { who });
        } else {
            EpayConfigs::<T>::remove(&who);
            Self::deposit_event(Event::EpayRemoved { who });
        }

        Ok(())
    }
}
```

---

## 集成指南

### 添加依赖

在您的 pallet 的 `Cargo.toml` 中添加依赖：

```toml
[dependencies]
pallet-trading-common = { version = "0.1.0", default-features = false, path = "../trading-common" }

[features]
default = ["std"]
std = [
    "pallet-trading-common/std",
    # ... 其他依赖
]
```

### 在 Pallet 中使用

#### 示例 1: OTC 订单系统

```rust
use frame_support::{dispatch::DispatchResult, pallet_prelude::*};
use pallet_trading_common::{mask_name, mask_id_card, is_valid_tron_address};

#[pallet::config]
pub trait Config: frame_system::Config {
    type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
}

#[pallet::pallet]
pub struct Pallet<T>(_);

#[pallet::storage]
pub type OrderInfo<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::AccountId,
    (Vec<u8>, Vec<u8>, Vec<u8>),  // (masked_name, masked_id, tron_address)
>;

#[pallet::call]
impl<T: Config> Pallet<T> {
    /// 创建 OTC 订单，存储脱敏信息
    #[pallet::weight(10_000)]
    pub fn create_order(
        origin: OriginFor<T>,
        full_name: Vec<u8>,
        id_card: Vec<u8>,
        tron_address: Vec<u8>,
    ) -> DispatchResult {
        let buyer = ensure_signed(origin)?;

        // 验证 TRON 地址
        ensure!(
            is_valid_tron_address(&tron_address),
            Error::<T>::InvalidTronAddress
        );

        // 脱敏处理
        let name_str = sp_std::str::from_utf8(&full_name)
            .map_err(|_| Error::<T>::InvalidUtf8)?;
        let id_str = sp_std::str::from_utf8(&id_card)
            .map_err(|_| Error::<T>::InvalidUtf8)?;

        let masked_name = mask_name(name_str);
        let masked_id = mask_id_card(id_str);

        // 存储脱敏后的信息
        OrderInfo::<T>::insert(&buyer, (masked_name, masked_id, tron_address));

        Self::deposit_event(Event::OrderCreated { buyer });
        Ok(())
    }
}

#[pallet::event]
#[pallet::generate_deposit(pub(super) fn deposit_event)]
pub enum Event<T: Config> {
    OrderCreated { buyer: T::AccountId },
}

#[pallet::error]
pub enum Error<T> {
    InvalidTronAddress,
    InvalidUtf8,
}
```

#### 示例 2: Market Maker 配置

```rust
use pallet_trading_common::{is_valid_tron_address, is_valid_epay_config};

#[pallet::storage]
pub type MakerConfig<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::AccountId,
    (Vec<u8>, Option<Vec<u8>>, Option<Vec<u8>>),  // (tron, epay_no, epay_key)
>;

#[pallet::call]
impl<T: Config> Pallet<T> {
    /// 配置 Market Maker
    #[pallet::weight(10_000)]
    pub fn configure_maker(
        origin: OriginFor<T>,
        tron_address: Vec<u8>,
        epay_no: Option<Vec<u8>>,
        epay_key: Option<Vec<u8>>,
    ) -> DispatchResult {
        let maker = ensure_signed(origin)?;

        // 验证 TRON 地址
        ensure!(
            is_valid_tron_address(&tron_address),
            Error::<T>::InvalidTronAddress
        );

        // 验证 EPAY 配置
        ensure!(
            is_valid_epay_config(&epay_no, &epay_key),
            Error::<T>::InvalidEpayConfig
        );

        // 存储配置
        MakerConfig::<T>::insert(&maker, (tron_address, epay_no, epay_key));

        Self::deposit_event(Event::MakerConfigured { maker });
        Ok(())
    }
}
```

---

## API 参考

### 脱敏函数

#### `mask_name(full_name: &str) -> Vec<u8>`

姓名脱敏处理。

**参数：**
- `full_name: &str` - 完整姓名（UTF-8 字符串）

**返回：**
- `Vec<u8>` - 脱敏后的姓名字节数组

**示例：**
```rust
let masked = mask_name("张三");  // "×三"
```

---

#### `mask_id_card(id_card: &str) -> Vec<u8>`

身份证号脱敏处理。

**参数：**
- `id_card: &str` - 完整身份证号（ASCII 字符串）

**返回：**
- `Vec<u8>` - 脱敏后的身份证号字节数组

**示例：**
```rust
let masked = mask_id_card("110101199001011234");  // "1101**********1234"
```

---

#### `mask_birthday(birthday: &str) -> Vec<u8>`

生日脱敏处理。

**参数：**
- `birthday: &str` - 完整生日（格式: YYYY-MM-DD）

**返回：**
- `Vec<u8>` - 脱敏后的生日字节数组

**示例：**
```rust
let masked = mask_birthday("1990-01-01");  // "1990-xx-xx"
```

---

### 验证函数

#### `is_valid_tron_address(address: &[u8]) -> bool`

验证 TRON 地址格式。

**参数：**
- `address: &[u8]` - TRON 地址字节数组

**返回：**
- `bool` - 有效返回 `true`，无效返回 `false`

**验证规则：**
- 长度必须为 34 字符
- 必须以 'T' 开头
- 只能包含 Base58 字符集

**示例：**
```rust
let is_valid = is_valid_tron_address(b"TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS");  // true
```

---

#### `is_valid_epay_config(epay_no: &Option<Vec<u8>>, epay_key: &Option<Vec<u8>>) -> bool`

验证 EPAY 配置完整性。

**参数：**
- `epay_no: &Option<Vec<u8>>` - EPAY 商户号（可选）
- `epay_key: &Option<Vec<u8>>` - EPAY 密钥（可选）

**返回：**
- `bool` - 有效返回 `true`，无效返回 `false`

**验证规则：**
- 都不配置：有效
- 完整配置且长度符合要求：有效
- 只配置一项：无效

**示例：**
```rust
let is_valid = is_valid_epay_config(&None, &None);  // true（都不配置）
let is_valid = is_valid_epay_config(
    &Some(b"1234567890".to_vec()),
    &Some(b"1234567890123456".to_vec())
);  // true（完整配置）
```

---

## 测试

运行单元测试：

```bash
# 测试整个 crate
cargo test -p pallet-trading-common

# 测试特定模块
cargo test -p pallet-trading-common mask::tests
cargo test -p pallet-trading-common validation::tests

# 查看测试覆盖率
cargo test -p pallet-trading-common -- --show-output
```

测试用例涵盖：
- ✅ 各种长度的姓名脱敏
- ✅ 18位/15位/短身份证号脱敏
- ✅ 标准/异常生日格式脱敏
- ✅ 有效/无效 TRON 地址验证
- ✅ 各种 EPAY 配置组合验证

---

## 设计理念

### 1. 无状态工具库

`trading-common` 不维护任何链上状态，所有函数都是纯函数，输入相同则输出相同。这使得：
- 代码更容易测试和验证
- 可以在多个 pallet 中安全共享
- 不会引入额外的存储成本

### 2. no_std 兼容

完全兼容 `no_std` 环境，可在 WebAssembly 运行时中使用：
- 使用 `sp_std::prelude::*` 替代标准库
- 使用 `alloc::string::String` 进行字符串操作
- 避免使用文件系统、网络等系统调用

### 3. 隐私优先

数据脱敏遵循最小信息原则：
- 姓名脱敏保留基本识别性
- 身份证保留区域和年龄信息
- 生日只保留年份用于年龄验证

### 4. 安全验证

严格的格式验证防止无效数据进入系统：
- TRON 地址验证防止跨链交易错误
- EPAY 配置验证确保支付系统正常运行

---

## 性能考虑

### 计算复杂度

| 函数 | 时间复杂度 | 空间复杂度 |
|------|-----------|-----------|
| `mask_name` | O(n) | O(n) |
| `mask_id_card` | O(n) | O(n) |
| `mask_birthday` | O(1) | O(1) |
| `is_valid_tron_address` | O(n) | O(1) |
| `is_valid_epay_config` | O(1) | O(1) |

其中 n 为输入字符串长度。

### 优化建议

1. **批量操作**：如需处理大量数据，建议在链下批量脱敏后再提交
2. **缓存验证结果**：对于频繁验证的地址，可在上层缓存验证结果
3. **提前验证**：在交易提交前在客户端进行格式验证，减少链上失败交易

---

## 使用场景

### 1. OTC 交易系统

```rust
// pallet-otc-order 中使用
use pallet_trading_common::{mask_name, mask_id_card, is_valid_tron_address};

pub fn create_order(
    buyer_name: &str,
    buyer_id: &str,
    tron_addr: &[u8],
) -> DispatchResult {
    ensure!(is_valid_tron_address(tron_addr), Error::<T>::InvalidAddress);
    let masked_name = mask_name(buyer_name);
    let masked_id = mask_id_card(buyer_id);
    // 存储脱敏信息...
    Ok(())
}
```

### 2. Market Maker 配置

```rust
// pallet-otc-maker 中使用
use pallet_trading_common::{is_valid_tron_address, is_valid_epay_config};

pub fn configure_maker(
    tron_address: Vec<u8>,
    epay_no: Option<Vec<u8>>,
    epay_key: Option<Vec<u8>>,
) -> DispatchResult {
    ensure!(is_valid_tron_address(&tron_address), Error::<T>::InvalidTronAddress);
    ensure!(is_valid_epay_config(&epay_no, &epay_key), Error::<T>::InvalidEpayConfig);
    // 存储配置...
    Ok(())
}
```

### 3. KYC 验证系统

```rust
// pallet-identity 中使用
use pallet_trading_common::{mask_name, mask_id_card, mask_birthday};

pub fn submit_kyc(
    full_name: &str,
    id_card: &str,
    birthday: &str,
) -> DispatchResult {
    let masked_name = mask_name(full_name);
    let masked_id = mask_id_card(id_card);
    let masked_birthday = mask_birthday(birthday);
    // 存储脱敏后的 KYC 信息...
    Ok(())
}
```

---

## 依赖关系

### 最小依赖设计

```toml
[dependencies]
codec = { package = "parity-scale-codec", version = "3.6.12" }
scale-info = { version = "2.11.3" }
sp-core = { git = "https://github.com/paritytech/polkadot-sdk.git", branch = "stable2409" }
sp-std = { git = "https://github.com/paritytech/polkadot-sdk.git", branch = "stable2409" }
```

仅依赖 Substrate 核心库，无第三方依赖，确保：
- 编译速度快
- 安全性高
- 版本兼容性好

---

## 常见问题

### Q1: 为什么不直接在各个 pallet 中实现这些函数？

**A:** 提取为公共库有以下优势：
- 避免代码重复，减少维护成本
- 统一脱敏和验证规则，确保一致性
- 便于单独测试和审计
- 其他项目也可以复用

### Q2: 脱敏函数是否可逆？

**A:** 不可逆。脱敏是单向过程，无法从脱敏结果还原原始信息。这是隐私保护的基本要求。

### Q3: TRON 地址验证是否包含校验和验证？

**A:** 当前仅验证格式（长度、前缀、字符集）。完整的校验和验证需要 Base58 解码和 SHA256 计算，计算成本较高，建议在链下进行。

### Q4: 如何添加新的脱敏规则？

**A:** 在 `src/mask.rs` 中添加新函数，并在 `src/lib.rs` 中重新导出：

```rust
// src/mask.rs
pub fn mask_email(email: &str) -> Vec<u8> {
    // 实现邮箱脱敏逻辑
}

// src/lib.rs
pub use mask::{mask_name, mask_id_card, mask_birthday, mask_email};
```

### Q5: 是否支持其他区块链地址验证？

**A:** 当前仅支持 TRON。如需支持其他链（如 Bitcoin、Ethereum），可在 `src/validation.rs` 中添加相应的验证函数。

---

## 未来计划

- [ ] 添加更多区块链地址验证（Bitcoin, Ethereum, BSC）
- [ ] 支持邮箱、手机号脱敏
- [ ] 添加银行卡号脱敏
- [ ] 提供配置化的脱敏规则
- [ ] 支持 TRON 地址校验和验证
- [ ] 添加性能基准测试

---

## 贡献指南

欢迎提交 Issue 和 Pull Request！

### 添加新功能

1. 在对应模块中添加函数实现
2. 在 `src/lib.rs` 中重新导出
3. 添加完整的单元测试
4. 更新 README 文档

### 代码规范

- 所有函数必须有详细的中文注释
- 必须添加单元测试且覆盖率 > 90%
- 必须支持 `no_std` 环境
- 遵循 Rust 官方代码风格

---

## 许可证

Unlicense

---

## 相关资源

- [Polkadot SDK 文档](https://paritytech.github.io/polkadot-sdk/master/polkadot_sdk_docs/index.html)
- [Substrate 开发指南](https://docs.substrate.io/)
- [TRON 地址格式规范](https://developers.tron.network/docs/account)
- [Base58 编码说明](https://en.wikipedia.org/wiki/Binary-to-text_encoding#Base58)

---

## 联系方式

- GitHub: [memoio/stardust](https://github.com/memoio/stardust)
- 项目维护: StarDust Team

---

**最后更新**: 2025-11-11
