// 健康检查和基础路由
use axum::{extract::State, Json};
use std::time::SystemTime;

use crate::{
    models::{ApiResponse, HealthResponse, ServiceStatus},
    AppState,
};

/// 健康检查端点
pub async fn health_handler(State(state): State<AppState>) -> Json<ApiResponse<HealthResponse>> {
    // 检查各服务状态
    let substrate_ok = state.substrate.health_check().await;
    let redis_ok = state.cache.health_check().await;
    let divination_ok = state.divination.health_check().await;

    let uptime = SystemTime::now()
        .duration_since(state.start_time)
        .unwrap_or_default()
        .as_secs();

    let health = HealthResponse {
        status: if substrate_ok && redis_ok {
            "healthy".to_string()
        } else {
            "degraded".to_string()
        },
        version: env!("CARGO_PKG_VERSION").to_string(),
        uptime,
        services: ServiceStatus {
            substrate: substrate_ok,
            redis: redis_ok,
            divination: divination_ok,
        },
    };

    Json(ApiResponse::success(health))
}

/// 版本信息端点
pub async fn version_handler() -> Json<ApiResponse<serde_json::Value>> {
    let version_info = serde_json::json!({
        "name": env!("CARGO_PKG_NAME"),
        "version": env!("CARGO_PKG_VERSION"),
        "description": "星尘链 API Gateway",
    });

    Json(ApiResponse::success(version_info))
}
