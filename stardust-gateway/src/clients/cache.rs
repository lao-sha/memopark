// Redis 缓存客户端 - 统一缓存操作接口
use redis::{aio::ConnectionManager, AsyncCommands, Client};
use serde::{de::DeserializeOwned, Serialize};
use std::time::Duration;

use crate::models::ApiError;

/// Redis 缓存客户端
#[derive(Clone)]
pub struct CacheClient {
    /// 连接管理器
    manager: ConnectionManager,
    /// 默认过期时间（秒）
    default_ttl: usize,
}

impl CacheClient {
    /// 创建新的缓存客户端
    pub async fn new(redis_url: &str, default_ttl: usize) -> Result<Self, ApiError> {
        let client = Client::open(redis_url)
            .map_err(|e| ApiError::Cache(format!("Failed to connect to Redis: {}", e)))?;

        let manager = ConnectionManager::new(client)
            .await
            .map_err(|e| ApiError::Cache(format!("Failed to create connection manager: {}", e)))?;

        Ok(Self {
            manager,
            default_ttl,
        })
    }

    /// 获取缓存值
    pub async fn get<T: DeserializeOwned>(&self, key: &str) -> Result<Option<T>, ApiError> {
        let mut conn = self.manager.clone();
        let value: Option<String> = conn
            .get(key)
            .await
            .map_err(|e| ApiError::Cache(format!("Failed to get key {}: {}", key, e)))?;

        match value {
            Some(v) => {
                let data = serde_json::from_str(&v)
                    .map_err(|e| ApiError::Cache(format!("Failed to deserialize: {}", e)))?;
                Ok(Some(data))
            }
            None => Ok(None),
        }
    }

    /// 设置缓存值（使用默认 TTL）
    pub async fn set<T: Serialize>(&self, key: &str, value: &T) -> Result<(), ApiError> {
        self.set_ex(key, value, self.default_ttl).await
    }

    /// 设置缓存值（指定 TTL）
    pub async fn set_ex<T: Serialize>(
        &self,
        key: &str,
        value: &T,
        ttl: usize,
    ) -> Result<(), ApiError> {
        let mut conn = self.manager.clone();
        let serialized = serde_json::to_string(value)
            .map_err(|e| ApiError::Cache(format!("Failed to serialize: {}", e)))?;

        conn.set_ex(key, serialized, ttl)
            .await
            .map_err(|e| ApiError::Cache(format!("Failed to set key {}: {}", key, e)))?;

        Ok(())
    }

    /// 删除缓存值
    pub async fn delete(&self, key: &str) -> Result<(), ApiError> {
        let mut conn = self.manager.clone();
        conn.del(key)
            .await
            .map_err(|e| ApiError::Cache(format!("Failed to delete key {}: {}", key, e)))?;
        Ok(())
    }

    /// 批量删除（通配符匹配）
    pub async fn delete_pattern(&self, pattern: &str) -> Result<u64, ApiError> {
        let mut conn = self.manager.clone();

        // 扫描匹配的 key
        let keys: Vec<String> = redis::cmd("KEYS")
            .arg(pattern)
            .query_async(&mut conn)
            .await
            .map_err(|e| ApiError::Cache(format!("Failed to scan keys: {}", e)))?;

        if keys.is_empty() {
            return Ok(0);
        }

        // 批量删除
        let count: u64 = conn
            .del(&keys)
            .await
            .map_err(|e| ApiError::Cache(format!("Failed to delete keys: {}", e)))?;

        Ok(count)
    }

    /// 检查 key 是否存在
    pub async fn exists(&self, key: &str) -> Result<bool, ApiError> {
        let mut conn = self.manager.clone();
        conn.exists(key)
            .await
            .map_err(|e| ApiError::Cache(format!("Failed to check key {}: {}", key, e)))
    }

    /// 设置过期时间
    pub async fn expire(&self, key: &str, ttl: usize) -> Result<(), ApiError> {
        let mut conn = self.manager.clone();
        conn.expire(key, ttl)
            .await
            .map_err(|e| ApiError::Cache(format!("Failed to set expiry for key {}: {}", key, e)))?;
        Ok(())
    }

    /// 获取或设置缓存（如果不存在则执行回调函数并缓存结果）
    pub async fn get_or_set<T, F, Fut>(
        &self,
        key: &str,
        ttl: usize,
        fallback: F,
    ) -> Result<T, ApiError>
    where
        T: Serialize + DeserializeOwned,
        F: FnOnce() -> Fut,
        Fut: std::future::Future<Output = Result<T, ApiError>>,
    {
        // 先尝试从缓存获取
        if let Some(cached) = self.get::<T>(key).await? {
            tracing::debug!("Cache hit for key: {}", key);
            return Ok(cached);
        }

        // 缓存未命中，执行回调
        tracing::debug!("Cache miss for key: {}", key);
        let value = fallback().await?;

        // 将结果写入缓存
        self.set_ex(key, &value, ttl).await?;

        Ok(value)
    }

    /// 健康检查
    pub async fn health_check(&self) -> bool {
        let mut conn = self.manager.clone();
        redis::cmd("PING")
            .query_async::<_, String>(&mut conn)
            .await
            .map(|response| response == "PONG")
            .unwrap_or(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore] // 需要 Redis 实例
    async fn test_cache_operations() {
        let cache = CacheClient::new("redis://127.0.0.1:6379", 60)
            .await
            .expect("Failed to connect to Redis");

        // 测试设置和获取
        cache
            .set("test_key", &"test_value".to_string())
            .await
            .unwrap();
        let value: Option<String> = cache.get("test_key").await.unwrap();
        assert_eq!(value, Some("test_value".to_string()));

        // 测试删除
        cache.delete("test_key").await.unwrap();
        let value: Option<String> = cache.get("test_key").await.unwrap();
        assert_eq!(value, None);
    }
}
