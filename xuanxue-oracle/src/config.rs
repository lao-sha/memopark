use serde::Deserialize;
use anyhow::{Context, Result};
use std::path::Path;

/// Oracle节点配置
#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    pub chain: ChainConfig,
    pub deepseek: DeepSeekConfig,
    pub ipfs: IpfsConfig,
    pub oracle: OracleConfig,
    pub cache: CacheConfig,
    pub logging: LoggingConfig,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ChainConfig {
    pub ws_endpoint: String,
    pub oracle_account_seed: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DeepSeekConfig {
    pub api_key: String,
    pub base_url: String,
    pub model: String,
    pub temperature: f32,
    pub max_tokens: u32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct IpfsConfig {
    pub api_url: String,
    pub pinata_api_key: Option<String>,
    pub pinata_secret: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OracleConfig {
    pub name: String,
    pub supported_divination_types: u8,
    pub supported_interpretation_types: u16,
    pub min_oracle_rating: u16,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CacheConfig {
    pub db_path: String,
    pub ttl_seconds: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LoggingConfig {
    pub level: String,
    pub filter: String,
}

impl Config {
    /// 从配置文件和环境变量加载配置
    pub fn load() -> Result<Self> {
        // 加载.env文件
        dotenv::dotenv().ok();

        // 加载config.toml
        let settings = config::Config::builder()
            .add_source(config::File::with_name("config"))
            .add_source(config::Environment::default())
            .build()
            .context("Failed to build configuration")?;

        let config: Config = settings
            .try_deserialize()
            .context("Failed to deserialize configuration")?;

        Ok(config)
    }

    /// 从指定路径加载配置
    pub fn load_from<P: AsRef<Path>>(path: P) -> Result<Self> {
        let settings = config::Config::builder()
            .add_source(config::File::from(path.as_ref()))
            .add_source(config::Environment::default())
            .build()?;

        Ok(settings.try_deserialize()?)
    }
}
