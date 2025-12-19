// 区块链查询路由
use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};

use crate::{
    models::{ApiError, ApiResponse},
    AppState,
};

/// 查询最新区块信息
pub async fn latest_block_handler(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<BlockInfo>>, ApiError> {
    let block_number = state.substrate.latest_block_number().await?;
    let block_hash = state.substrate.latest_block_hash().await?;

    Ok(Json(ApiResponse::success(BlockInfo {
        number: block_number,
        hash: block_hash,
    })))
}

/// 查询 Runtime 版本
pub async fn runtime_version_handler(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<serde_json::Value>>, ApiError> {
    let version = state.substrate.runtime_version().await?;

    Ok(Json(ApiResponse::success(serde_json::json!({
        "spec_name": version.spec_name,
        "impl_name": version.impl_name,
        "spec_version": version.spec_version,
    }))))
}

/// 查询账户信息
#[derive(Debug, Deserialize)]
pub struct AccountQuery {
    pub address: String,
}

pub async fn account_info_handler(
    State(state): State<AppState>,
    axum::extract::Query(query): axum::extract::Query<AccountQuery>,
) -> Result<Json<ApiResponse<serde_json::Value>>, ApiError> {
    // 验证地址格式
    if query.address.is_empty() {
        return Err(ApiError::BadRequest("Address is required".to_string()));
    }

    // 这里应该调用 substrate client 查询账户信息
    // 由于需要 runtime metadata，暂时返回占位数据
    Ok(Json(ApiResponse::success(serde_json::json!({
        "address": query.address,
        "balance": "0",
        "nonce": 0,
        "note": "实际查询需要生成 runtime metadata"
    }))))
}

#[derive(Debug, Serialize)]
struct BlockInfo {
    number: u64,
    hash: String,
}
