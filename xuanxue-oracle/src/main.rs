#![allow(dead_code)]
#![allow(unused_imports)]
#![allow(unused_variables)]

mod blockchain;
mod ai;
mod storage;
mod divination;
mod utils;
mod config;
mod error;
mod knowledge;

use anyhow::Result;
use tracing::info;
use tracing_subscriber;

use crate::config::Config;
use crate::blockchain::EventMonitor;

#[tokio::main]
async fn main() -> Result<()> {
    // 初始化日志
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    info!("🚀 Xuanxue Oracle Node Starting...");

    // 加载配置
    let config = Config::load()?;
    info!("✅ Configuration loaded");

    // 初始化区块链连接
    let mut event_monitor = EventMonitor::new(config).await?;
    info!("✅ Connected to blockchain at {}", event_monitor.endpoint());

    // 注册Oracle节点(如果尚未注册)
    event_monitor.ensure_registered().await?;
    info!("✅ Oracle node registered");

    // 开始监听事件
    info!("👂 Listening for interpretation requests...");
    event_monitor.watch_events().await?;

    Ok(())
}
