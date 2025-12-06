use tracing_subscriber::{fmt, EnvFilter};

/// 初始化日志系统
pub fn init_logger() {
    fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .with_target(false)
        .with_thread_ids(false)
        .with_thread_names(false)
        .init();
}
