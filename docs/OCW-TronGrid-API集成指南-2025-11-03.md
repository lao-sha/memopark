# OCW TronGrid API 集成指南

> 编写时间：2025-11-03  
> 版本：v1.0  
> 状态：生产就绪框架 + 详细实现指南

---

## 📊 概览

本文档提供完整的 **Off-Chain Worker (OCW) + TronGrid API** 集成方案，用于自动验证 TRON 链上的 TRC20 USDT 交易。

### 实现状态

| 功能模块 | 状态 | 说明 |
|---------|------|------|
| **基础超时检测** | ✅ 已实现 | 自动退款超时订单 |
| **HTTP 请求框架** | 📝 框架就绪 | 需根据实际 API 调整 |
| **JSON 解析** | 📝 框架就绪 | 需根据实际响应调整 |
| **ValidateUnsigned** | 📝 框架就绪 | 需补充完整实现 |
| **无签名交易** | 📝 框架就绪 | 需 Runtime 配置 |

---

## 🎯 核心目标

1. **自动验证 TRON 交易**
   - 做市商提交 TRC20 交易哈希
   - OCW 自动查询 TronGrid API
   - 验证交易真实性和金额

2. **自动超时处理**
   - 检测超时订单
   - 提交无签名交易执行退款
   - 记录信用分

3. **错误处理和重试**
   - HTTP 请求失败重试
   - API 限流处理
   - 日志记录

---

## 🚀 方案 1：简化实现（推荐用于 MVP）

### 当前已实现的简化方案

**位置**：`pallets/bridge/src/lib.rs`

```rust
#[pallet::hooks]
impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
    fn offchain_worker(block_number: BlockNumberFor<T>) {
        sp_runtime::print("🌉 Bridge OCW 开始执行");
        let _ = Self::check_timeout_swaps(block_number);
    }
}

impl<T: Config> Pallet<T> {
    fn check_timeout_swaps(current_block: BlockNumberFor<T>) -> Result<(), ()> {
        let next_id = NextSwapId::<T>::get();
        let start_id = if next_id > 100 { next_id - 100 } else { 0 };
        
        for swap_id in start_id..next_id {
            if let Some(mut record) = MakerSwaps::<T>::get(swap_id) {
                if record.status != SwapStatus::Pending {
                    continue;
                }
                
                // 检查是否超时
                if current_block >= record.timeout_at {
                    // 退款给用户
                    if let Err(_e) = T::Escrow::refund_all(swap_id, &record.user) {
                        continue;
                    }
                    
                    // 记录超时到信用分 ✅
                    let _ = T::Credit::record_maker_order_timeout(
                        record.maker_id,
                        swap_id,
                    );
                    
                    // 更新状态为 Refunded
                    record.status = SwapStatus::Refunded;
                    MakerSwaps::<T>::insert(swap_id, record.clone());
                }
            }
        }
        
        Ok(())
    }
}
```

**优点**：
- ✅ 已实现并测试通过
- ✅ 无需外部 API
- ✅ 自动超时退款
- ✅ 信用分自动记录

**缺点**：
- ⚠️ 无法验证 TRON 交易真实性
- ⚠️ 依赖做市商诚信

**适用场景**：
- MVP 阶段
- 初期小规模测试
- 配合人工审核使用

---

## 🔧 方案 2：完整实现（生产环境）

### 第一步：添加依赖

**文件**：`pallets/bridge/Cargo.toml`

```toml
[dependencies]
# ... 现有依赖 ...

# OCW HTTP 请求
sp-io = { default-features = false, git = "https://github.com/paritytech/polkadot-sdk.git", branch = "stable2506" }

# Hex 编码/解码（用于 TRON 交易哈希）
hex = { version = "0.4", default-features = false, features = ["alloc"] }

# JSON 解析（用于 TronGrid API 响应）
serde = { version = "1.0", default-features = false, features = ["derive", "alloc"] }
serde_json = { version = "1.0", default-features = false, features = ["alloc"] }
# 或使用 lite-json（Substrate 推荐的轻量级 JSON 库）
lite-json = { version = "0.2", default-features = false }

[features]
std = [
    # ... 现有 std features ...
    "sp-io/std",
    "hex/std",
    "serde/std",
    "serde_json/std",
    # 或
    # "lite-json/std",
]
```

---

### 第二步：实现 TRON 交易验证

**文件**：`pallets/bridge/src/lib.rs`

```rust
impl<T: Config> Pallet<T> {
    /// 函数级详细中文注释：验证 TRON 交易
    /// 
    /// ## 功能说明
    /// 1. 构建 TronGrid API 请求
    /// 2. 发起 HTTP 请求
    /// 3. 解析 JSON 响应
    /// 4. 验证交易内容
    /// 
    /// ## 参数
    /// - `tx_hash`: TRON 交易哈希
    /// - `expected_to`: 预期接收地址
    /// - `expected_amount_usdt`: 预期 USDT 金额（单位：10^6）
    /// 
    /// ## 返回
    /// - `Ok(true)`: 验证通过
    /// - `Ok(false)`: 验证失败
    /// - `Err(())`: 网络错误或 API 错误
    fn verify_tron_transaction(
        tx_hash: &[u8],
        expected_to: &[u8],
        expected_amount_usdt: u64,
    ) -> Result<bool, ()> {
        // 1. 将交易哈希转换为 hex 字符串
        use sp_std::vec::Vec;
        let tx_hash_hex = hex::encode(tx_hash);
        
        // 2. 构建 API URL
        // 测试网：https://api.shasta.trongrid.io
        // 主网：https://api.trongrid.io
        let api_base = b"https://api.trongrid.io";
        let api_path = b"/v1/transactions/";
        
        let mut url = Vec::new();
        url.extend_from_slice(api_base);
        url.extend_from_slice(api_path);
        url.extend_from_slice(tx_hash_hex.as_bytes());
        
        let url_str = sp_std::str::from_utf8(&url).map_err(|_| ())?;
        
        // 3. 发起 HTTP 请求
        use sp_runtime::offchain::http;
        
        let request = http::Request::get(url_str);
        
        // 设置超时时间（5秒）
        let timeout = sp_io::offchain::timestamp()
            .add(sp_runtime::offchain::Duration::from_millis(5000));
        
        let pending = request
            .deadline(timeout)
            .send()
            .map_err(|e| {
                sp_runtime::print("❌ OCW: HTTP 请求失败");
                ()
            })?;
        
        // 4. 等待响应
        let response = pending
            .try_wait(timeout)
            .map_err(|_| ())?
            .map_err(|_| ())?;
        
        // 5. 检查 HTTP 状态码
        if response.code != 200 {
            sp_runtime::print("❌ OCW: HTTP 状态码错误");
            return Err(());
        }
        
        // 6. 读取响应体
        let body = response.body().collect::<Vec<u8>>();
        
        // 7. 解析 JSON（使用 lite-json 或 serde_json）
        // 方式 A：使用 lite-json（推荐）
        let body_str = sp_std::str::from_utf8(&body).map_err(|_| ())?;
        
        // TODO: 解析 JSON 响应
        // 需要验证的字段：
        // - ret[0].contractRet == "SUCCESS"
        // - raw_data.contract[0].parameter.value.to_address == expected_to
        // - raw_data.contract[0].parameter.value.amount == expected_amount_usdt
        
        // 示例 JSON 响应结构：
        // {
        //   "ret": [{"contractRet": "SUCCESS"}],
        //   "txID": "...",
        //   "raw_data": {
        //     "contract": [{
        //       "parameter": {
        //         "value": {
        //           "to_address": "410000...",
        //           "amount": 1000000
        //         }
        //       }
        //     }]
        //   }
        // }
        
        // 简化实现（需根据实际 API 响应调整）
        let is_valid = Self::parse_tron_response(
            body_str,
            expected_to,
            expected_amount_usdt,
        )?;
        
        Ok(is_valid)
    }
    
    /// 函数级详细中文注释：解析 TronGrid API 响应
    /// 
    /// ## 使用 lite-json 解析（推荐）
    fn parse_tron_response(
        json_str: &str,
        expected_to: &[u8],
        expected_amount: u64,
    ) -> Result<bool, ()> {
        // 使用 lite-json 解析
        use lite_json::json::JsonValue;
        
        let json: JsonValue = lite_json::parse_json(json_str)
            .map_err(|_| {
                sp_runtime::print("❌ OCW: JSON 解析失败");
                ()
            })?;
        
        // 1. 检查 ret[0].contractRet
        // let ret_status = json
        //     .get("ret")
        //     .and_then(|ret| ret.get(0))
        //     .and_then(|ret0| ret0.get("contractRet"))
        //     .and_then(|cr| cr.as_str())
        //     .ok_or(())?;
        // 
        // if ret_status != "SUCCESS" {
        //     return Ok(false);
        // }
        
        // 2. 检查 to_address
        // let to_address = json
        //     .get("raw_data")
        //     .and_then(|rd| rd.get("contract"))
        //     .and_then(|c| c.get(0))
        //     .and_then(|c0| c0.get("parameter"))
        //     .and_then(|p| p.get("value"))
        //     .and_then(|v| v.get("to_address"))
        //     .and_then(|ta| ta.as_str())
        //     .ok_or(())?;
        // 
        // // 将 hex 地址转换为 bytes
        // let to_address_bytes = hex::decode(to_address).map_err(|_| ())?;
        // if to_address_bytes != expected_to {
        //     return Ok(false);
        // }
        
        // 3. 检查 amount
        // let amount = json
        //     .get("raw_data")
        //     .and_then(|rd| rd.get("contract"))
        //     .and_then(|c| c.get(0))
        //     .and_then(|c0| c0.get("parameter"))
        //     .and_then(|p| p.get("value"))
        //     .and_then(|v| v.get("amount"))
        //     .and_then(|a| a.as_number())
        //     .ok_or(())?;
        // 
        // if amount as u64 != expected_amount {
        //     return Ok(false);
        // }
        
        // TODO: 实现完整的 JSON 解析和验证
        // 当前返回 true（需替换为实际验证逻辑）
        sp_runtime::print("⚠️ OCW: TRON 验证逻辑待实现");
        Ok(true)
    }
}
```

---

### 第三步：添加 ocw_process_timeout Extrinsic

**文件**：`pallets/bridge/src/lib.rs`

```rust
#[pallet::call]
impl<T: Config> Pallet<T> {
    // ... 现有 extrinsics ...
    
    /// 函数级详细中文注释：OCW 处理超时订单（无签名交易）
    /// 
    /// ## 功能说明
    /// 此函数由 OCW 通过无签名交易调用，用于自动处理超时订单
    /// 
    /// ## 参数
    /// - `origin`: 必须是 None（无签名）
    /// - `swap_id`: 兑换ID
    /// 
    /// ## 返回
    /// - `Ok(())`: 成功
    /// - `Err(...)`: 失败
    #[pallet::call_index(10)]
    #[pallet::weight(10_000)]  // TODO: 使用实际权重
    pub fn ocw_process_timeout(
        origin: OriginFor<T>,
        swap_id: u64,
    ) -> DispatchResult {
        // 1. 确保是无签名交易
        ensure_none(origin)?;
        
        // 2. 获取兑换记录
        let mut record = MakerSwaps::<T>::get(swap_id)
            .ok_or(Error::<T>::SwapNotFound)?;
        
        // 3. 验证状态
        ensure!(
            record.status == SwapStatus::Pending,
            Error::<T>::InvalidStatus
        );
        
        // 4. 验证超时
        let current_block = frame_system::Pallet::<T>::block_number();
        ensure!(
            current_block >= record.timeout_at,
            Error::<T>::NotTimedOut  // 需添加此错误类型
        );
        
        // 5. 退款
        T::Escrow::refund_all(swap_id, &record.user)?;
        
        // 6. 记录超时到信用分
        let _ = T::Credit::record_maker_order_timeout(
            record.maker_id,
            swap_id,
        );
        
        // 7. 更新状态
        record.status = SwapStatus::Refunded;
        MakerSwaps::<T>::insert(swap_id, record);
        
        // 8. 发出事件
        Self::deposit_event(Event::MakerSwapRefunded {
            swap_id,
            reason: b"timeout".to_vec(),
        });
        
        Ok(())
    }
}
```

**添加错误类型**：

```rust
#[pallet::error]
pub enum Error<T> {
    // ... 现有错误 ...
    
    /// 订单未超时
    NotTimedOut,
}
```

---

### 第四步：实现 ValidateUnsigned

**文件**：`pallets/bridge/src/lib.rs`

```rust
#[pallet::validate_unsigned]
impl<T: Config> ValidateUnsigned for Pallet<T> {
    type Call = Call<T>;
    
    fn validate_unsigned(
        _source: TransactionSource,
        call: &Self::Call,
    ) -> TransactionValidity {
        match call {
            Call::ocw_process_timeout { swap_id } => {
                // 验证 swap_id 是否真的超时
                if let Some(record) = MakerSwaps::<T>::get(swap_id) {
                    // 必须是 Pending 状态
                    if record.status != SwapStatus::Pending {
                        return InvalidTransaction::Stale.into();
                    }
                    
                    // 必须已超时
                    let current_block = frame_system::Pallet::<T>::block_number();
                    if current_block < record.timeout_at {
                        return InvalidTransaction::Future.into();
                    }
                    
                    // 构建有效交易
                    return ValidTransaction::with_tag_prefix("BridgeOCW")
                        .priority(100)
                        .and_provides(vec![
                            b"bridge_timeout",
                            &swap_id.to_le_bytes()
                        ])
                        .longevity(5)
                        .propagate(true)
                        .build();
                }
                
                InvalidTransaction::BadProof.into()
            },
            _ => InvalidTransaction::Call.into(),
        }
    }
}
```

**添加必要的 use 语句**：

```rust
use sp_runtime::{
    transaction_validity::{
        InvalidTransaction, TransactionSource, TransactionValidity, ValidTransaction,
    },
};
```

---

### 第五步：更新 OCW 提交无签名交易

**文件**：`pallets/bridge/src/lib.rs`

```rust
impl<T: Config> Pallet<T> {
    fn check_timeout_swaps(current_block: BlockNumberFor<T>) -> Result<(), ()> {
        let next_id = NextSwapId::<T>::get();
        let start_id = if next_id > 100 { next_id - 100 } else { 0 };
        
        for swap_id in start_id..next_id {
            if let Some(record) = MakerSwaps::<T>::get(swap_id) {
                if record.status != SwapStatus::Pending {
                    continue;
                }
                
                // 检查是否超时
                if current_block >= record.timeout_at {
                    sp_runtime::print("⚠️ Bridge OCW: 检测到超时兑换");
                    
                    // 提交无签名交易
                    let call = Call::ocw_process_timeout { swap_id };
                    
                    // 方式 A：使用 SubmitTransaction（推荐）
                    use frame_system::offchain::SubmitTransaction;
                    let result = SubmitTransaction::<T, Call<T>>::submit_unsigned_transaction(
                        call.into()
                    );
                    
                    match result {
                        Ok(()) => {
                            sp_runtime::print("✅ Bridge OCW: 成功提交无签名交易");
                        },
                        Err(_) => {
                            sp_runtime::print("❌ Bridge OCW: 提交无签名交易失败");
                        }
                    }
                }
            }
        }
        
        Ok(())
    }
}
```

---

### 第六步：Runtime 配置

**文件**：`runtime/src/lib.rs`

```rust
// 1. 为 Runtime 实现 CreateSignedTransaction
impl<LocalCall> frame_system::offchain::CreateSignedTransaction<LocalCall> for Runtime
where
    RuntimeCall: From<LocalCall>,
{
    fn create_transaction<C: frame_system::offchain::AppCrypto<Self::Public, Self::Signature>>(
        call: RuntimeCall,
        _public: <Signature as Verify>::Signer,
        _account: AccountId,
        nonce: Nonce,
    ) -> Option<(RuntimeCall, <UncheckedExtrinsic as Extrinsic>::SignaturePayload)> {
        let tip = 0;
        let extra: SignedExtra = (
            frame_system::CheckNonZeroSender::<Runtime>::new(),
            frame_system::CheckSpecVersion::<Runtime>::new(),
            frame_system::CheckTxVersion::<Runtime>::new(),
            frame_system::CheckGenesis::<Runtime>::new(),
            frame_system::CheckEra::<Runtime>::from(generic::Era::mortal(256, 0)),
            frame_system::CheckNonce::<Runtime>::from(nonce),
            frame_system::CheckWeight::<Runtime>::new(),
            pallet_transaction_payment::ChargeTransactionPayment::<Runtime>::from(tip),
        );
        let raw_payload = SignedPayload::new(call, extra)
            .map_err(|_| {
                sp_runtime::print("❌ 创建签名 payload 失败");
            })
            .ok()?;
        let signature = raw_payload.using_encoded(|payload| {
            C::sign(payload, _public)
        })?;
        let address = AccountIdLookup::unlookup(_account);
        let (call, extra, _) = raw_payload.deconstruct();
        Some((call, (address, signature, extra)))
    }
}

// 2. 实现 SigningTypes
impl frame_system::offchain::SigningTypes for Runtime {
    type Public = <Signature as Verify>::Signer;
    type Signature = Signature;
}

// 3. 实现 SendTransactionTypes
impl<LocalCall> frame_system::offchain::SendTransactionTypes<LocalCall> for Runtime
where
    RuntimeCall: From<LocalCall>,
{
    type Extrinsic = UncheckedExtrinsic;
    type OverarchingCall = RuntimeCall;
}
```

---

## 📝 实现步骤总结

| 步骤 | 内容 | 文件 | 状态 |
|------|------|------|------|
| 1 | 添加依赖 | `pallets/bridge/Cargo.toml` | 📝 框架就绪 |
| 2 | TRON 交易验证 | `pallets/bridge/src/lib.rs` | 📝 框架就绪 |
| 3 | ocw_process_timeout | `pallets/bridge/src/lib.rs` | 📝 框架就绪 |
| 4 | ValidateUnsigned | `pallets/bridge/src/lib.rs` | 📝 框架就绪 |
| 5 | 提交无签名交易 | `pallets/bridge/src/lib.rs` | 📝 框架就绪 |
| 6 | Runtime 配置 | `runtime/src/lib.rs` | 📝 框架就绪 |
| 7 | 测试和调试 | - | ⏳ 待执行 |

---

## 🧪 测试步骤

### 1. 单元测试

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_verify_tron_transaction() {
        // TODO: 实现单元测试
    }
    
    #[test]
    fn test_ocw_process_timeout() {
        // TODO: 实现单元测试
    }
}
```

### 2. 集成测试

1. **启动测试网节点**
   ```bash
   ./target/release/stardust-node --dev --tmp
   ```

2. **创建测试兑换**
   - 买家创建兑换订单
   - 等待超时

3. **观察 OCW 日志**
   ```bash
   tail -f /tmp/stardust-node.log | grep OCW
   ```

4. **验证自动退款**
   - 检查订单状态是否变为 Refunded
   - 检查用户余额是否恢复
   - 检查做市商信用分是否降低

### 3. 真实网络测试

1. **使用 TRON Shasta 测试网**
   - API: `https://api.shasta.trongrid.io`
   - 测试币水龙头: `https://www.trongrid.io/shasta`

2. **创建真实 TRC20 交易**
   - 使用 TronLink 钱包
   - 发送测试 USDT

3. **验证 OCW 查询**
   - 观察 OCW 日志
   - 检查 HTTP 请求是否成功
   - 检查 JSON 解析是否正确

---

## ⚠️ 注意事项

### 1. API 限流

TronGrid API 有请求限制：
- **免费版**：100 请求/秒
- **付费版**：1000+ 请求/秒

**建议**：
- 添加请求间隔（例如每 6 秒一次）
- 批量处理订单
- 使用付费 API key

### 2. 错误处理

```rust
// 建议的错误处理模式
fn verify_tron_transaction_with_retry(
    tx_hash: &[u8],
    expected_to: &[u8],
    expected_amount_usdt: u64,
) -> Result<bool, ()> {
    const MAX_RETRIES: u32 = 3;
    
    for attempt in 0..MAX_RETRIES {
        match Self::verify_tron_transaction(tx_hash, expected_to, expected_amount_usdt) {
            Ok(result) => return Ok(result),
            Err(_) if attempt < MAX_RETRIES - 1 => {
                sp_runtime::print("⚠️ OCW: 重试中...");
                // 等待 1 秒
                sp_io::offchain::sleep_until(
                    sp_io::offchain::timestamp()
                        .add(sp_runtime::offchain::Duration::from_millis(1000))
                );
                continue;
            },
            Err(_) => return Err(()),
        }
    }
    
    Err(())
}
```

### 3. 网络环境

OCW 需要节点有外网访问权限：
- 确保防火墙允许出站 HTTPS 请求
- 配置 DNS 解析
- 考虑使用代理（如需要）

---

## 💡 优化建议

### 1. 缓存机制

```rust
// 使用 OCW 本地存储缓存验证结果
fn cache_verification_result(tx_hash: &[u8], is_valid: bool) {
    use sp_io::offchain::local_storage;
    
    let key = [b"tron_verification_", tx_hash].concat();
    let value = if is_valid { b"1" } else { b"0" };
    
    local_storage::set(
        sp_runtime::offchain::StorageKind::PERSISTENT,
        &key,
        value,
    );
}

fn get_cached_verification(tx_hash: &[u8]) -> Option<bool> {
    use sp_io::offchain::local_storage;
    
    let key = [b"tron_verification_", tx_hash].concat();
    let value = local_storage::get(
        sp_runtime::offchain::StorageKind::PERSISTENT,
        &key,
    )?;
    
    match value.as_slice() {
        b"1" => Some(true),
        b"0" => Some(false),
        _ => None,
    }
}
```

### 2. 批量处理

```rust
fn check_timeout_swaps_batch(current_block: BlockNumberFor<T>) -> Result<(), ()> {
    let mut timeout_swap_ids = Vec::new();
    
    // 1. 批量收集超时订单
    let next_id = NextSwapId::<T>::get();
    let start_id = if next_id > 100 { next_id - 100 } else { 0 };
    
    for swap_id in start_id..next_id {
        if let Some(record) = MakerSwaps::<T>::get(swap_id) {
            if record.status == SwapStatus::Pending 
                && current_block >= record.timeout_at 
            {
                timeout_swap_ids.push(swap_id);
            }
        }
    }
    
    // 2. 批量提交无签名交易
    for swap_id in timeout_swap_ids {
        let call = Call::ocw_process_timeout { swap_id };
        let _ = SubmitTransaction::<T, Call<T>>::submit_unsigned_transaction(call.into());
    }
    
    Ok(())
}
```

### 3. 监控和告警

```rust
// 使用 offchain index 记录 OCW 执行统计
#[pallet::storage]
pub type OcwStats<T> = StorageValue<_, OcwStatistics, ValueQuery>;

#[derive(Encode, Decode, TypeInfo, MaxEncodedLen, Clone, Default)]
pub struct OcwStatistics {
    pub total_checks: u64,
    pub total_timeouts: u64,
    pub total_refunds: u64,
    pub last_run_block: u32,
    pub http_errors: u64,
    pub verification_errors: u64,
}

impl<T: Config> Pallet<T> {
    fn update_ocw_stats(
        current_block: BlockNumberFor<T>,
        timeout_count: u32,
        http_errors: u32,
    ) {
        OcwStats::<T>::mutate(|stats| {
            stats.total_checks += 1;
            stats.total_timeouts += timeout_count as u64;
            stats.last_run_block = current_block.saturated_into();
            stats.http_errors += http_errors as u64;
        });
    }
}
```

---

## 📚 参考资源

### TronGrid API 文档

- **官方文档**: https://developers.tron.network/reference/introduction
- **API 端点**: 
  - 测试网: `https://api.shasta.trongrid.io`
  - 主网: `https://api.trongrid.io`
- **交易查询**: `GET /v1/transactions/{tx_hash}`
- **TRC20 合约**: USDT 合约地址
  - 主网: `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`
  - 测试网: (需查询)

### Substrate OCW 文档

- **官方指南**: https://docs.substrate.io/build/offchain-workers/
- **HTTP 请求**: https://docs.rs/sp-runtime/latest/sp_runtime/offchain/http/
- **无签名交易**: https://docs.substrate.io/build/unsigned-transactions/

---

## 🎯 推荐实施路径

### 阶段 1：MVP（当前已完成）✅

- [x] 基础超时检测
- [x] 直接退款（无需 TRON 验证）
- [x] 信用分记录

### 阶段 2：完整实现（本指南）📝

- [ ] 添加依赖
- [ ] 实现 TRON 验证
- [ ] 实现 ValidateUnsigned
- [ ] 测试网测试

### 阶段 3：生产优化⏳

- [ ] API 限流处理
- [ ] 缓存机制
- [ ] 批量处理
- [ ] 监控和告警

---

*本指南由 AI 辅助生成于 2025-11-03*
*建议在测试网充分测试后再部署到主网*

