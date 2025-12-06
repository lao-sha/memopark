// 并发处理和缓存优化模块
// src/performance/mod.rs

use std::sync::Arc;
use std::collections::HashMap;
use tokio::sync::{RwLock, Semaphore};
use tokio::time::{Duration, Instant};
use serde::{Serialize, Deserialize};
use anyhow::Result;

/// 缓存项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheItem<T> {
    pub data: T,
    pub expires_at: Instant,
    pub hit_count: u64,
}

/// 缓存管理器
pub struct CacheManager<K, V>
where
    K: std::hash::Hash + Eq + Clone,
    V: Clone,
{
    cache: Arc<RwLock<HashMap<K, CacheItem<V>>>>,
    ttl: Duration,
    max_size: usize,
}

impl<K, V> CacheManager<K, V>
where
    K: std::hash::Hash + Eq + Clone,
    V: Clone,
{
    /// 创建新的缓存管理器
    pub fn new(ttl: Duration, max_size: usize) -> Self {
        Self {
            cache: Arc::new(RwLock::new(HashMap::new())),
            ttl,
            max_size,
        }
    }

    /// 获取缓存项
    pub async fn get(&self, key: &K) -> Option<V> {
        let mut cache = self.cache.write().await;

        if let Some(item) = cache.get_mut(key) {
            // 检查是否过期
            if Instant::now() < item.expires_at {
                item.hit_count += 1;
                return Some(item.data.clone());
            } else {
                // 过期,删除
                cache.remove(key);
            }
        }

        None
    }

    /// 设置缓存项
    pub async fn set(&self, key: K, value: V) {
        let mut cache = self.cache.write().await;

        // 检查缓存大小
        if cache.len() >= self.max_size {
            // 删除最少使用的项
            if let Some(lru_key) = self.find_lru_key(&cache) {
                cache.remove(&lru_key);
            }
        }

        cache.insert(key, CacheItem {
            data: value,
            expires_at: Instant::now() + self.ttl,
            hit_count: 0,
        });
    }

    /// 删除缓存项
    pub async fn remove(&self, key: &K) {
        let mut cache = self.cache.write().await;
        cache.remove(key);
    }

    /// 清空缓存
    pub async fn clear(&self) {
        let mut cache = self.cache.write().await;
        cache.clear();
    }

    /// 获取缓存统计
    pub async fn stats(&self) -> CacheStats {
        let cache = self.cache.read().await;

        let total_items = cache.len();
        let total_hits: u64 = cache.values().map(|item| item.hit_count).sum();
        let expired_items = cache.values()
            .filter(|item| Instant::now() >= item.expires_at)
            .count();

        CacheStats {
            total_items,
            total_hits,
            expired_items,
            max_size: self.max_size,
        }
    }

    /// 清理过期项
    pub async fn cleanup(&self) {
        let mut cache = self.cache.write().await;
        let now = Instant::now();

        cache.retain(|_, item| now < item.expires_at);
    }

    /// 找到最少使用的key
    fn find_lru_key(&self, cache: &HashMap<K, CacheItem<V>>) -> Option<K> {
        cache.iter()
            .min_by_key(|(_, item)| item.hit_count)
            .map(|(key, _)| key.clone())
    }
}

/// 缓存统计信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheStats {
    pub total_items: usize,
    pub total_hits: u64,
    pub expired_items: usize,
    pub max_size: usize,
}

/// 并发控制器
pub struct ConcurrencyController {
    /// 信号量,控制最大并发数
    semaphore: Arc<Semaphore>,
    /// 最大并发数
    max_concurrent: usize,
    /// 当前活跃任务数
    active_tasks: Arc<RwLock<usize>>,
}

impl ConcurrencyController {
    /// 创建新的并发控制器
    pub fn new(max_concurrent: usize) -> Self {
        Self {
            semaphore: Arc::new(Semaphore::new(max_concurrent)),
            max_concurrent,
            active_tasks: Arc::new(RwLock::new(0)),
        }
    }

    /// 获取许可
    pub async fn acquire(&self) -> Result<ConcurrencyPermit> {
        let permit = self.semaphore.clone().acquire_owned().await?;

        let mut active = self.active_tasks.write().await;
        *active += 1;

        Ok(ConcurrencyPermit {
            _permit: permit,
            active_tasks: Arc::clone(&self.active_tasks),
        })
    }

    /// 获取当前活跃任务数
    pub async fn active_count(&self) -> usize {
        *self.active_tasks.read().await
    }

    /// 获取可用许可数
    pub fn available_permits(&self) -> usize {
        self.semaphore.available_permits()
    }
}

/// 并发许可
pub struct ConcurrencyPermit {
    _permit: tokio::sync::OwnedSemaphorePermit,
    active_tasks: Arc<RwLock<usize>>,
}

impl Drop for ConcurrencyPermit {
    fn drop(&mut self) {
        let active_tasks = Arc::clone(&self.active_tasks);
        tokio::spawn(async move {
            let mut active = active_tasks.write().await;
            *active = active.saturating_sub(1);
        });
    }
}

/// 请求队列
pub struct RequestQueue<T> {
    queue: Arc<RwLock<Vec<T>>>,
    max_size: usize,
}

impl<T> RequestQueue<T> {
    /// 创建新队列
    pub fn new(max_size: usize) -> Self {
        Self {
            queue: Arc::new(RwLock::new(Vec::new())),
            max_size,
        }
    }

    /// 添加请求到队列
    pub async fn push(&self, item: T) -> Result<()> {
        let mut queue = self.queue.write().await;

        if queue.len() >= self.max_size {
            return Err(anyhow::anyhow!("Queue is full"));
        }

        queue.push(item);
        Ok(())
    }

    /// 从队列取出请求
    pub async fn pop(&self) -> Option<T> {
        let mut queue = self.queue.write().await;
        queue.pop()
    }

    /// 获取队列长度
    pub async fn len(&self) -> usize {
        let queue = self.queue.read().await;
        queue.len()
    }

    /// 队列是否为空
    pub async fn is_empty(&self) -> bool {
        let queue = self.queue.read().await;
        queue.is_empty()
    }
}

/// 性能监控器
pub struct PerformanceMonitor {
    metrics: Arc<RwLock<PerformanceMetrics>>,
}

impl PerformanceMonitor {
    pub fn new() -> Self {
        Self {
            metrics: Arc::new(RwLock::new(PerformanceMetrics::default())),
        }
    }

    /// 记录请求开始
    pub async fn record_request_start(&self) {
        let mut metrics = self.metrics.write().await;
        metrics.total_requests += 1;
        metrics.active_requests += 1;
    }

    /// 记录请求完成
    pub async fn record_request_complete(&self, duration: Duration, success: bool) {
        let mut metrics = self.metrics.write().await;
        metrics.active_requests = metrics.active_requests.saturating_sub(1);

        if success {
            metrics.successful_requests += 1;
        } else {
            metrics.failed_requests += 1;
        }

        metrics.total_duration += duration;
        metrics.update_average_duration();

        if duration > metrics.max_duration {
            metrics.max_duration = duration;
        }
        if metrics.min_duration.is_zero() || duration < metrics.min_duration {
            metrics.min_duration = duration;
        }
    }

    /// 获取指标
    pub async fn get_metrics(&self) -> PerformanceMetrics {
        self.metrics.read().await.clone()
    }

    /// 重置指标
    pub async fn reset(&self) {
        let mut metrics = self.metrics.write().await;
        *metrics = PerformanceMetrics::default();
    }
}

/// 性能指标
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    pub total_requests: u64,
    pub successful_requests: u64,
    pub failed_requests: u64,
    pub active_requests: usize,
    pub total_duration: Duration,
    pub average_duration: Duration,
    pub min_duration: Duration,
    pub max_duration: Duration,
}

impl Default for PerformanceMetrics {
    fn default() -> Self {
        Self {
            total_requests: 0,
            successful_requests: 0,
            failed_requests: 0,
            active_requests: 0,
            total_duration: Duration::from_secs(0),
            average_duration: Duration::from_secs(0),
            min_duration: Duration::from_secs(0),
            max_duration: Duration::from_secs(0),
        }
    }
}

impl PerformanceMetrics {
    fn update_average_duration(&mut self) {
        if self.successful_requests > 0 {
            self.average_duration = self.total_duration / self.successful_requests as u32;
        }
    }

    pub fn success_rate(&self) -> f64 {
        if self.total_requests == 0 {
            return 0.0;
        }
        self.successful_requests as f64 / self.total_requests as f64 * 100.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_cache_manager() {
        let cache = CacheManager::new(Duration::from_secs(60), 100);

        // 测试设置和获取
        cache.set("key1".to_string(), "value1".to_string()).await;
        let value = cache.get(&"key1".to_string()).await;
        assert_eq!(value, Some("value1".to_string()));

        // 测试不存在的key
        let value = cache.get(&"key2".to_string()).await;
        assert_eq!(value, None);
    }

    #[tokio::test]
    async fn test_concurrency_controller() {
        let controller = ConcurrencyController::new(2);

        let _permit1 = controller.acquire().await.unwrap();
        let _permit2 = controller.acquire().await.unwrap();

        assert_eq!(controller.active_count().await, 2);
        assert_eq!(controller.available_permits(), 0);
    }

    #[tokio::test]
    async fn test_request_queue() {
        let queue = RequestQueue::new(10);

        queue.push(1).await.unwrap();
        queue.push(2).await.unwrap();

        assert_eq!(queue.len().await, 2);
        assert_eq!(queue.pop().await, Some(2));
        assert_eq!(queue.len().await, 1);
    }
}
