//! # OCW 中继服务
//!
//! 函数级详细中文注释：实现 Off-Chain Worker 桥接中继逻辑

use crate::*;
use frame_support::pallet_prelude::*;
use frame_system::pallet_prelude::BlockNumberFor;
use sp_runtime::offchain::http;
use sp_std::{vec, vec::Vec};

impl<T: Config> Pallet<T> {
	/// 函数级详细中文注释：处理待处理的桥接请求
	///
	/// ## 功能说明
	/// 扫描 Pending 状态的桥接请求，调用 Arbitrum 合约铸造 ERC20 DUST
	///
	/// ## 流程
	/// 1. 扫描最近的 100 个桥接请求
	/// 2. 筛选出 Pending 状态的请求
	/// 3. 调用 Arbitrum RPC 发送交易
	/// 4. 更新桥接状态
	///
	/// ## 返回
	/// - `Ok(())`: 成功
	/// - `Err(())`: 失败（仅用于日志）
	pub(crate) fn process_pending_bridges() -> Result<(), ()> {
		sp_runtime::print("🔍 开始扫描待处理的桥接请求");

		// 获取下一个桥接 ID
		let next_id = NextBridgeId::<T>::get();
		if next_id == 0 {
			return Ok(());
		}

		// 扫描最近的 100 个桥接请求
		let start_id = if next_id > 100 { next_id - 100 } else { 0 };
		let mut pending_count = 0u32;

		for bridge_id in start_id..next_id {
			if let Some(request) = BridgeRequests::<T>::get(bridge_id) {
				// 只处理 Pending 状态的请求
				if request.status != BridgeStatus::Pending {
					continue;
				}

				// 检查是否超时
				let current_block = frame_system::Pallet::<T>::block_number();
				if current_block >= request.created_at + T::BridgeTimeout::get() {
					sp_runtime::print("⏰ 桥接请求超时");
					// 标记为失败
					let _ = Self::submit_update_bridge_status(
						bridge_id,
						BridgeStatus::Failed,
						None,
					);
					continue;
				}

				pending_count += 1;
				sp_runtime::print("📤 处理桥接请求");

				// 调用 Arbitrum 合约铸造 DUST
				match Self::call_arbitrum_mint(&request) {
					Ok(tx_hash) => {
						sp_runtime::print("✅ Arbitrum 交易已发送");
						// 更新状态为 Completed
						let _ = Self::submit_update_bridge_status(
							bridge_id,
							BridgeStatus::Completed,
							Some(tx_hash),
						);
					},
					Err(_e) => {
						sp_runtime::print("❌ Arbitrum 交易失败");
						// 可以设置重试机制（暂时标记为 Processing）
						let _ = Self::submit_update_bridge_status(
							bridge_id,
							BridgeStatus::Processing,
							None,
						);
					},
				}
			}
		}

		if pending_count > 0 {
			sp_runtime::print("✅ 处理了待处理的桥接请求");
		}

		Ok(())
	}

	/// 函数级详细中文注释：调用 Arbitrum 合约铸造 DUST
	///
	/// ## 功能说明
	/// 1. 构建 mint() 调用数据
	/// 2. 发送 HTTP 请求到 Arbitrum RPC
	/// 3. 解析交易哈希
	///
	/// ## 参数
	/// - `request`: 桥接请求
	///
	/// ## 返回
	/// - `Ok(tx_hash)`: 交易哈希
	/// - `Err(())`: 失败
	fn call_arbitrum_mint(
		_request: &BridgeRequest<T::AccountId, BalanceOf<T>, BlockNumberFor<T>>,
	) -> Result<Vec<u8>, ()> {
		// 获取 Arbitrum 桥接合约地址
		let _bridge_address = ArbitrumBridgeAddress::<T>::get().ok_or(())?;

		sp_runtime::print("🔨 构建 Arbitrum mint 交易");

		// TODO: 实现 EIP-712 签名和交易发送
		// 1. 构建 mint(uint64 bridgeId, address to, uint256 amount) 调用数据
		// 2. 签名交易
		// 3. 发送到 Arbitrum RPC
		// 4. 等待交易确认

		// 当前为占位符实现，返回模拟交易哈希
		// 实际实现需要：
		// - 使用 sp_io::crypto::ecdsa_sign 签名交易
		// - 使用 http::Request 发送到 Arbitrum RPC
		// - 解析响应获取交易哈希

		sp_runtime::print("⚠️ Arbitrum mint 调用未实现（占位符）");

		// 模拟交易哈希（实际实现时删除此行）
		let mock_tx_hash = b"0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef".to_vec();

		Ok(mock_tx_hash)
	}

	/// 函数级详细中文注释：处理 Arbitrum 事件
	///
	/// ## 功能说明
	/// 监听 Arbitrum BridgeBack 事件，解锁 Stardust 链上的 DUST
	///
	/// ## 流程
	/// 1. 查询 Arbitrum 最新区块
	/// 2. 获取 BridgeBack 事件
	/// 3. 解析事件数据
	/// 4. 提交无签名交易解锁 DUST
	///
	/// ## 返回
	/// - `Ok(())`: 成功
	/// - `Err(())`: 失败（仅用于日志）
	pub(crate) fn process_arbitrum_events() -> Result<(), ()> {
		sp_runtime::print("🔍 开始监听 Arbitrum 事件");

		// TODO: 实现 Arbitrum 事件监听
		// 1. 查询 Arbitrum 最新区块
		// 2. 获取 BridgeBack(address from, uint256 amount, bytes substrateAddress) 事件
		// 3. 解析事件数据
		// 4. 提交无签名交易解锁 DUST

		// 当前为占位符实现
		// 实际实现需要：
		// - 使用 http::Request 查询 Arbitrum RPC
		// - 解析事件日志（event.topics 和 event.data）
		// - 调用 submit_unlock_dust() 提交交易

		sp_runtime::print("⚠️ Arbitrum 事件监听未实现（占位符）");

		Ok(())
	}

	/// 函数级详细中文注释：提交更新桥接状态的无签名交易
	///
	/// ## 功能说明
	/// OCW 通过此方法提交无签名交易，更新链上的桥接状态
	///
	/// ## 参数
	/// - `bridge_id`: 桥接 ID
	/// - `status`: 新状态
	/// - `arbitrum_tx_hash`: Arbitrum 交易哈希（可选）
	///
	/// ## 返回
	/// - `Ok(())`: 成功
	/// - `Err(())`: 失败
	fn submit_update_bridge_status(
		_bridge_id: u64,
		_status: BridgeStatus,
		_arbitrum_tx_hash: Option<Vec<u8>>,
	) -> Result<(), ()> {
		sp_runtime::print("📝 提交更新桥接状态交易");

		// TODO: 实现无签名交易提交
		// 使用 SubmitTransaction API 提交无签名交易
		// let call = Call::ocw_update_bridge_status { bridge_id, status, arbitrum_tx_hash };
		// SubmitTransaction::<T, Call<T>>::submit_unsigned_transaction(call.into())

		sp_runtime::print("⚠️ 无签名交易提交未实现（占位符）");

		Ok(())
	}

	/// 函数级详细中文注释：提交解锁 DUST 的无签名交易
	///
	/// ## 功能说明
	/// OCW 通过此方法提交无签名交易，解锁 DUST 给用户
	///
	/// ## 参数
	/// - `arbitrum_tx_hash`: Arbitrum 交易哈希
	/// - `substrate_address`: Substrate 接收地址
	/// - `amount`: DUST 数量
	///
	/// ## 返回
	/// - `Ok(())`: 成功
	/// - `Err(())`: 失败
	#[allow(dead_code)]
	fn submit_unlock_dust(
		_arbitrum_tx_hash: Vec<u8>,
		_substrate_address: T::AccountId,
		_amount: BalanceOf<T>,
	) -> Result<(), ()> {
		sp_runtime::print("📝 提交解锁 DUST 交易");

		// TODO: 实现无签名交易提交
		// 使用 SubmitTransaction API 提交无签名交易
		// let call = Call::unlock_from_arbitrum { arbitrum_tx_hash, substrate_address, amount };
		// SubmitTransaction::<T, Call<T>>::submit_unsigned_transaction(call.into())

		sp_runtime::print("⚠️ 无签名交易提交未实现（占位符）");

		Ok(())
	}

	/// 函数级详细中文注释：发送 HTTP 请求到 Arbitrum RPC
	///
	/// ## 功能说明
	/// 封装 HTTP 请求，用于调用 Arbitrum JSON-RPC
	///
	/// ## 参数
	/// - `method`: JSON-RPC 方法（如 "eth_sendRawTransaction"）
	/// - `params`: 参数数组
	///
	/// ## 返回
	/// - `Ok(response_body)`: 响应体
	/// - `Err(())`: 失败
	#[allow(dead_code)]
	fn send_arbitrum_rpc_request(
		_method: &str,
		_params: Vec<&str>,
	) -> Result<Vec<u8>, ()> {
		// Arbitrum RPC URL（可以从链上配置读取）
		let rpc_url = "https://arb1.arbitrum.io/rpc";

		sp_runtime::print("🌐 发送 HTTP 请求到 Arbitrum RPC");

		// 构建 JSON-RPC 请求体
		// 注意：sp_std 不支持 format!，这里使用硬编码的示例
		let request_body = br#"{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}"#;

		// 发送 HTTP POST 请求
		let pending = http::Request::post(rpc_url, vec![request_body])
			.add_header("Content-Type", "application/json")
			.send()
			.map_err(|_| ())?;

		// 等待响应
		let response = pending.wait().map_err(|_| ())?;

		// 检查 HTTP 状态码
		let code: u16 = response.code;
		if code != 200 {
			sp_runtime::print("❌ HTTP 请求失败");
			return Err(());
		}

		// 返回响应体
		Ok(response.body().collect::<Vec<u8>>())
	}
}

// ===== 无签名交易验证 =====

/// 函数级详细中文注释：无签名交易验证
/// 
/// ## 功能说明
/// 验证 OCW 提交的无签名交易是否合法
/// 
/// ## 验证规则
/// 1. `ocw_update_bridge_status`: 验证桥接 ID 存在且状态合法
/// 2. `unlock_from_arbitrum`: 验证交易哈希未被处理
impl<T: Config> sp_runtime::traits::ValidateUnsigned for Pallet<T> {
	type Call = Call<T>;

	fn validate_unsigned(_source: sp_runtime::transaction_validity::TransactionSource, call: &Self::Call) -> sp_runtime::transaction_validity::TransactionValidity {
		match call {
			// 验证 ocw_update_bridge_status
			Call::ocw_update_bridge_status { bridge_id, status: _, arbitrum_tx_hash: _ } => {
				// 检查桥接是否存在
				if !BridgeRequests::<T>::contains_key(bridge_id) {
					return sp_runtime::transaction_validity::InvalidTransaction::Custom(1).into();
				}

				sp_runtime::transaction_validity::ValidTransaction::with_tag_prefix("DustBridgeOCW")
					.priority(100)
					.and_provides(vec![b"ocw_update".to_vec(), bridge_id.encode()])
					.longevity(5)
					.propagate(true)
					.build()
			},
			// 验证 unlock_from_arbitrum
			Call::unlock_from_arbitrum { arbitrum_tx_hash, .. } => {
				// 转换交易哈希
				let tx_hash: Result<EthTxHash, _> = arbitrum_tx_hash.clone().try_into();
				if tx_hash.is_err() {
					return sp_runtime::transaction_validity::InvalidTransaction::Custom(2).into();
				}

				// 检查是否已处理（防重放）
				if ProcessedArbitrumTxs::<T>::contains_key(&tx_hash.unwrap()) {
					return sp_runtime::transaction_validity::InvalidTransaction::Custom(3).into();
				}

				sp_runtime::transaction_validity::ValidTransaction::with_tag_prefix("DustBridgeOCW")
					.priority(100)
					.and_provides(vec![b"ocw_unlock".to_vec(), arbitrum_tx_hash.encode()])
					.longevity(5)
					.propagate(true)
					.build()
			},
			_ => sp_runtime::transaction_validity::InvalidTransaction::Call.into(),
		}
	}
}

