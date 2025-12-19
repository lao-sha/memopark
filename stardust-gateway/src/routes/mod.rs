// 路由模块入口
pub mod blockchain;
pub mod divination;
pub mod health;

use axum::{
    middleware,
    routing::{get, post},
    Router,
};

use crate::{
    middleware::{auth_middleware, strict_rate_limit_middleware, RateLimiterState},
    AppState,
};

/// 构建所有路由
pub fn build_routes(state: AppState) -> Router {
    // 创建限流器
    let global_limiter = RateLimiterState::new(100); // 每秒 100 个请求
    let divination_limiter = RateLimiterState::new_strict(10); // 每分钟 10 个占卜请求

    Router::new()
        // 健康检查（无需认证）
        .route("/health", get(health::health_handler))
        .route("/version", get(health::version_handler))
        // 区块链查询（无需认证）
        .nest(
            "/api/v1/chain",
            Router::new()
                .route("/block/latest", get(blockchain::latest_block_handler))
                .route("/runtime/version", get(blockchain::runtime_version_handler))
                .route("/account", get(blockchain::account_info_handler)),
        )
        // 占卜接口（需要认证 + 严格限流）
        .nest(
            "/api/v1/divination",
            Router::new()
                .route("/xiaoliuren", post(divination::xiaoliuren_handler))
                .route("/ziwei", post(divination::ziwei_handler))
                .route("/liuyao", post(divination::liuyao_handler))
                .route("/daliuren", post(divination::daliuren_handler))
                .route("/qimen", post(divination::qimen_handler))
                .route("/tarot", post(divination::tarot_handler))
                .route("/history", get(divination::divination_history_handler))
                .layer(middleware::from_fn_with_state(
                    divination_limiter,
                    strict_rate_limit_middleware,
                ))
                .layer(middleware::from_fn_with_state(
                    state.config.clone(),
                    auth_middleware,
                )),
        )
        .with_state(state)
}
