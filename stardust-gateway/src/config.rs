// 配置管理模块 - 从环境变量和配置文件加载配置
use serde::Deserialize;
use std::env;

/// 应用配置结构
#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    /// 服务器配置
    pub server: ServerConfig,
    /// Substrate 节点配置
    pub substrate: SubstrateConfig,
    /// Redis 缓存配置
    pub redis: RedisConfig,
    /// 占卜服务配置
    pub divination: DivinationServiceConfig,
    /// 认证配置
    pub auth: AuthConfig,
    /// 日志配置
    pub logging: LoggingConfig,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ServerConfig {
    /// 监听地址
    #[serde(default = "default_host")]
    pub host: String,
    /// 监听端口
    #[serde(default = "default_port")]
    pub port: u16,
    /// 请求体大小限制（字节）
    #[serde(default = "default_body_limit")]
    pub body_limit: usize,
    /// 请求超时时间（秒）
    #[serde(default = "default_request_timeout")]
    pub request_timeout: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SubstrateConfig {
    /// WebSocket RPC 地址
    #[serde(default = "default_substrate_ws")]
    pub ws_url: String,
    /// 连接超时时间（秒）
    #[serde(default = "default_substrate_timeout")]
    pub timeout: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RedisConfig {
    /// Redis 连接 URL
    #[serde(default = "default_redis_url")]
    pub url: String,
    /// 连接池大小
    #[serde(default = "default_redis_pool_size")]
    pub pool_size: usize,
    /// 默认过期时间（秒）
    #[serde(default = "default_redis_ttl")]
    pub default_ttl: usize,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DivinationServiceConfig {
    /// 占卜服务基础 URL
    #[serde(default = "default_divination_url")]
    pub base_url: String,
    /// 请求超时时间（秒）
    #[serde(default = "default_divination_timeout")]
    pub timeout: u64,
    /// 重试次数
    #[serde(default = "default_divination_retries")]
    pub retries: u32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AuthConfig {
    /// JWT 密钥
    pub jwt_secret: String,
    /// Token 过期时间（秒）
    #[serde(default = "default_token_expiry")]
    pub token_expiry: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LoggingConfig {
    /// 日志级别 (trace, debug, info, warn, error)
    #[serde(default = "default_log_level")]
    pub level: String,
    /// 是否输出 JSON 格式
    #[serde(default)]
    pub json: bool,
}

// 默认值函数
fn default_host() -> String {
    "0.0.0.0".to_string()
}

fn default_port() -> u16 {
    8080
}

fn default_body_limit() -> usize {
    10 * 1024 * 1024 // 10MB
}

fn default_request_timeout() -> u64 {
    30
}

fn default_substrate_ws() -> String {
    "ws://127.0.0.1:9944".to_string()
}

fn default_substrate_timeout() -> u64 {
    10
}

fn default_redis_url() -> String {
    "redis://127.0.0.1:6379".to_string()
}

fn default_redis_pool_size() -> usize {
    20
}

fn default_redis_ttl() -> usize {
    3600 // 1小时
}

fn default_divination_url() -> String {
    "http://127.0.0.1:3001".to_string()
}

fn default_divination_timeout() -> u64 {
    30
}

fn default_divination_retries() -> u32 {
    3
}

fn default_token_expiry() -> i64 {
    86400 // 24小时
}

fn default_log_level() -> String {
    "info".to_string()
}

impl Config {
    /// 从环境变量和配置文件加载配置
    pub fn from_env() -> Result<Self, config::ConfigError> {
        // 加载 .env 文件（如果存在）
        dotenv::dotenv().ok();

        let config_builder = config::Config::builder()
            // 从配置文件加载（如果存在）
            .add_source(
                config::File::with_name("config/default")
                    .required(false)
            )
            // 从环境变量加载（覆盖配置文件）
            .add_source(
                config::Environment::with_prefix("STARDUST_GATEWAY")
                    .separator("__")
            );

        config_builder.build()?.try_deserialize()
    }

    /// 验证配置有效性
    pub fn validate(&self) -> Result<(), String> {
        if self.auth.jwt_secret.is_empty() {
            return Err("JWT secret cannot be empty".to_string());
        }

        if self.server.port == 0 {
            return Err("Server port must be greater than 0".to_string());
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        // 设置测试环境变量
        env::set_var("STARDUST_GATEWAY__AUTH__JWT_SECRET", "test_secret");

        let config = Config::from_env().expect("Failed to load config");
        assert_eq!(config.server.host, "0.0.0.0");
        assert_eq!(config.server.port, 8080);

        config.validate().expect("Invalid config");
    }
}
