// Substrate 客户端 - 与区块链节点交互
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;
use subxt::{OnlineClient, PolkadotConfig};

use crate::models::ApiError;

/// Substrate 客户端
#[derive(Clone)]
pub struct SubstrateClient {
    /// Subxt 客户端
    client: Arc<OnlineClient<PolkadotConfig>>,
}

impl SubstrateClient {
    /// 连接到 Substrate 节点
    pub async fn connect(ws_url: &str) -> Result<Self, ApiError> {
        let client = OnlineClient::<PolkadotConfig>::from_url(ws_url)
            .await
            .map_err(|e| {
                ApiError::Blockchain(format!("Failed to connect to Substrate node: {}", e))
            })?;

        tracing::info!("Connected to Substrate node at {}", ws_url);

        Ok(Self {
            client: Arc::new(client),
        })
    }

    /// 获取最新区块号
    pub async fn latest_block_number(&self) -> Result<u64, ApiError> {
        let block_hash = self
            .client
            .blocks()
            .at_latest()
            .await
            .map_err(|e| ApiError::Blockchain(format!("Failed to get latest block: {}", e)))?;

        Ok(block_hash.number() as u64)
    }

    /// 获取最新区块哈希
    pub async fn latest_block_hash(&self) -> Result<String, ApiError> {
        let block_hash = self
            .client
            .blocks()
            .at_latest()
            .await
            .map_err(|e| ApiError::Blockchain(format!("Failed to get latest block: {}", e)))?;

        Ok(format!("0x{}", hex::encode(block_hash.hash().0)))
    }

    /// 通用存储查询（返回原始 JSON）
    pub async fn query_storage_raw(
        &self,
        pallet: &str,
        storage: &str,
        params: Vec<Value>,
    ) -> Result<Option<Value>, ApiError> {
        // 注意：这是简化版本，实际使用需要根据具体 pallet 定义生成 metadata
        // 这里提供基础框架，实际项目中需要使用 subxt 的宏生成强类型接口

        tracing::debug!(
            "Querying storage: {}::{} with params: {:?}",
            pallet,
            storage,
            params
        );

        // TODO: 实现实际的存储查询逻辑
        // 需要根据 runtime metadata 生成对应的类型

        Err(ApiError::Internal(
            "Direct storage query not implemented, use typed queries instead".to_string(),
        ))
    }

    /// 查询账户余额
    pub async fn get_account_balance(&self, address: &str) -> Result<u128, ApiError> {
        // 解析账户地址
        let account_id = sp_core::crypto::AccountId32::from_string(address)
            .map_err(|e| ApiError::BadRequest(format!("Invalid address: {}", e)))?;

        // 查询余额（示例，需要根据实际 runtime 调整）
        // let storage_query = subxt::dynamic::storage("System", "Account", vec![Value::from_bytes(&account_id.0)]);

        // TODO: 实现实际的余额查询
        // 这里返回占位数据
        Err(ApiError::Internal(
            "Balance query not implemented, use subxt generated types".to_string(),
        ))
    }

    /// 提交交易（签名后的 extrinsic）
    pub async fn submit_extrinsic(&self, signed_extrinsic: Vec<u8>) -> Result<String, ApiError> {
        // TODO: 实现交易提交逻辑
        Err(ApiError::Internal(
            "Extrinsic submission not implemented".to_string(),
        ))
    }

    /// 健康检查
    pub async fn health_check(&self) -> bool {
        self.latest_block_number().await.is_ok()
    }

    /// 获取 Runtime 版本信息
    pub async fn runtime_version(&self) -> Result<RuntimeVersionInfo, ApiError> {
        let metadata = self.client.metadata();
        let runtime_metadata = metadata.runtime_metadata();

        Ok(RuntimeVersionInfo {
            spec_name: "stardust".to_string(),
            impl_name: "stardust-node".to_string(),
            spec_version: 101, // 从 CLAUDE.md 中获取
        })
    }
}

/// Runtime 版本信息
#[derive(Debug, Serialize, Deserialize)]
pub struct RuntimeVersionInfo {
    pub spec_name: String,
    pub impl_name: String,
    pub spec_version: u32,
}

// 示例：如何为特定 pallet 实现类型安全的查询
// 实际项目中应该使用 subxt macro 自动生成

/// 占卜记录查询结果（示例）
#[derive(Debug, Serialize, Deserialize)]
pub struct DivinationRecord {
    pub user: String,
    pub divination_type: String,
    pub result_hash: String,
    pub timestamp: u64,
}

impl SubstrateClient {
    /// 查询用户的占卜记录（示例方法）
    pub async fn get_divination_records(
        &self,
        user_address: &str,
    ) -> Result<Vec<DivinationRecord>, ApiError> {
        // TODO: 实现实际查询逻辑
        // 这里需要根据 runtime 定义的存储结构来实现

        tracing::debug!("Querying divination records for user: {}", user_address);

        // 占位返回
        Ok(vec![])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore] // 需要运行中的节点
    async fn test_substrate_connection() {
        let client = SubstrateClient::connect("ws://127.0.0.1:9944")
            .await
            .expect("Failed to connect");

        let block_number = client.latest_block_number().await.unwrap();
        assert!(block_number > 0);
    }
}
