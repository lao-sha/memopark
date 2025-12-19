// 星尘链 API Gateway 主程序入口
mod clients;
mod config;
mod middleware;
mod models;
mod routes;

use std::{net::SocketAddr, sync::Arc, time::SystemTime};

use axum::Router;
use tower::ServiceBuilder;
use tower_http::{
    compression::CompressionLayer,
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use clients::{CacheClient, DivinationClient, SubstrateClient};
use config::Config;

/// 应用状态 - 共享给所有路由和中间件
#[derive(Clone)]
pub struct AppState {
    /// 配置
    pub config: Config,
    /// Substrate 客户端
    pub substrate: SubstrateClient,
    /// Redis 缓存客户端
    pub cache: CacheClient,
    /// 占卜服务客户端
    pub divination: DivinationClient,
    /// 启动时间（用于计算 uptime）
    pub start_time: SystemTime,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // 加载配置
    let config = Config::from_env().expect("Failed to load configuration");
    config.validate().expect("Invalid configuration");

    // 初始化日志
    init_logging(&config.logging.level, config.logging.json);

    tracing::info!("🚀 星尘链 API Gateway 启动中...");
    tracing::info!("📝 配置: {:?}", config);

    // 初始化客户端
    let substrate = SubstrateClient::connect(&config.substrate.ws_url)
        .await
        .expect("Failed to connect to Substrate node");

    let cache = CacheClient::new(&config.redis.url, config.redis.default_ttl)
        .await
        .expect("Failed to connect to Redis");

    let divination = DivinationClient::new(
        config.divination.base_url.clone(),
        config.divination.timeout,
        config.divination.retries,
    );

    // 创建应用状态
    let state = AppState {
        config: config.clone(),
        substrate,
        cache,
        divination,
        start_time: SystemTime::now(),
    };

    // 构建路由
    let app = routes::build_routes(state);

    // 添加全局中间件
    let app = app.layer(
        ServiceBuilder::new()
            // 请求追踪
            .layer(TraceLayer::new_for_http())
            // CORS
            .layer(
                CorsLayer::new()
                    .allow_origin(Any)
                    .allow_methods(Any)
                    .allow_headers(Any),
            )
            // 响应压缩
            .layer(CompressionLayer::new()),
    );

    // 启动服务器
    let addr = SocketAddr::from(([0, 0, 0, 0], config.server.port));
    tracing::info!("🌐 Gateway 监听地址: {}", addr);
    tracing::info!("✨ 星尘链 API Gateway 已启动");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;

    Ok(())
}

/// 初始化日志系统
fn init_logging(level: &str, json: bool) {
    let env_filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new(level));

    if json {
        // JSON 格式输出（生产环境）
        tracing_subscriber::registry()
            .with(env_filter)
            .with(tracing_subscriber::fmt::layer().json())
            .init();
    } else {
        // 人类可读格式（开发环境）
        tracing_subscriber::registry()
            .with(env_filter)
            .with(
                tracing_subscriber::fmt::layer()
                    .with_target(true)
                    .with_thread_ids(true),
            )
            .init();
    }
}
