// Prometheus监控集成
// src/monitoring/prometheus.rs

use prometheus::{
    register_counter_vec, register_gauge_vec, register_histogram_vec,
    CounterVec, GaugeVec, HistogramVec, TextEncoder, Encoder,
};
use lazy_static::lazy_static;
use anyhow::Result;

lazy_static! {
    // 请求计数器
    pub static ref REQUEST_COUNTER: CounterVec = register_counter_vec!(
        "oracle_requests_total",
        "Total number of interpretation requests",
        &["divination_type", "interpretation_type", "status"]
    ).unwrap();

    // 请求延迟直方图
    pub static ref REQUEST_DURATION: HistogramVec = register_histogram_vec!(
        "oracle_request_duration_seconds",
        "Request duration in seconds",
        &["divination_type", "interpretation_type"],
        vec![1.0, 2.5, 5.0, 10.0, 15.0, 20.0, 30.0, 60.0]
    ).unwrap();

    // 活跃请求数
    pub static ref ACTIVE_REQUESTS: GaugeVec = register_gauge_vec!(
        "oracle_active_requests",
        "Number of currently active requests",
        &["divination_type"]
    ).unwrap();

    // AI API调用
    pub static ref AI_API_CALLS: CounterVec = register_counter_vec!(
        "oracle_ai_api_calls_total",
        "Total number of AI API calls",
        &["status"]
    ).unwrap();

    // AI API延迟
    pub static ref AI_API_DURATION: HistogramVec = register_histogram_vec!(
        "oracle_ai_api_duration_seconds",
        "AI API call duration in seconds",
        &["model"],
        vec![1.0, 3.0, 5.0, 8.0, 12.0, 20.0, 30.0]
    ).unwrap();

    // IPFS上传
    pub static ref IPFS_UPLOADS: CounterVec = register_counter_vec!(
        "oracle_ipfs_uploads_total",
        "Total number of IPFS uploads",
        &["provider", "status"]
    ).unwrap();

    // IPFS上传延迟
    pub static ref IPFS_UPLOAD_DURATION: HistogramVec = register_histogram_vec!(
        "oracle_ipfs_upload_duration_seconds",
        "IPFS upload duration in seconds",
        &["provider"],
        vec![0.5, 1.0, 2.0, 3.0, 5.0, 10.0]
    ).unwrap();

    // 区块链交易
    pub static ref BLOCKCHAIN_TX: CounterVec = register_counter_vec!(
        "oracle_blockchain_tx_total",
        "Total number of blockchain transactions",
        &["type", "status"]
    ).unwrap();

    // 区块链交易延迟
    pub static ref BLOCKCHAIN_TX_DURATION: HistogramVec = register_histogram_vec!(
        "oracle_blockchain_tx_duration_seconds",
        "Blockchain transaction duration in seconds",
        &["type"],
        vec![1.0, 3.0, 5.0, 10.0, 15.0, 30.0]
    ).unwrap();

    // 缓存指标
    pub static ref CACHE_HITS: CounterVec = register_counter_vec!(
        "oracle_cache_hits_total",
        "Total number of cache hits",
        &["cache_type"]
    ).unwrap();

    pub static ref CACHE_MISSES: CounterVec = register_counter_vec!(
        "oracle_cache_misses_total",
        "Total number of cache misses",
        &["cache_type"]
    ).unwrap();

    pub static ref CACHE_SIZE: GaugeVec = register_gauge_vec!(
        "oracle_cache_size",
        "Current cache size",
        &["cache_type"]
    ).unwrap();

    // 错误计数
    pub static ref ERROR_COUNTER: CounterVec = register_counter_vec!(
        "oracle_errors_total",
        "Total number of errors",
        &["error_type", "source"]
    ).unwrap();

    // 系统资源
    pub static ref MEMORY_USAGE: GaugeVec = register_gauge_vec!(
        "oracle_memory_usage_bytes",
        "Memory usage in bytes",
        &["type"]
    ).unwrap();

    pub static ref CPU_USAGE: GaugeVec = register_gauge_vec!(
        "oracle_cpu_usage_percent",
        "CPU usage percentage",
        &["core"]
    ).unwrap();
}

/// Prometheus指标收集器
pub struct PrometheusCollector;

impl PrometheusCollector {
    /// 记录请求开始
    pub fn record_request_start(divination_type: &str) {
        ACTIVE_REQUESTS
            .with_label_values(&[divination_type])
            .inc();
    }

    /// 记录请求完成
    pub fn record_request_complete(
        divination_type: &str,
        interpretation_type: &str,
        duration: f64,
        success: bool,
    ) {
        // 减少活跃请求
        ACTIVE_REQUESTS
            .with_label_values(&[divination_type])
            .dec();

        // 记录请求计数
        let status = if success { "success" } else { "failure" };
        REQUEST_COUNTER
            .with_label_values(&[divination_type, interpretation_type, status])
            .inc();

        // 记录请求延迟
        if success {
            REQUEST_DURATION
                .with_label_values(&[divination_type, interpretation_type])
                .observe(duration);
        }
    }

    /// 记录AI API调用
    pub fn record_ai_api_call(model: &str, duration: f64, success: bool) {
        let status = if success { "success" } else { "failure" };
        AI_API_CALLS
            .with_label_values(&[status])
            .inc();

        if success {
            AI_API_DURATION
                .with_label_values(&[model])
                .observe(duration);
        }
    }

    /// 记录IPFS上传
    pub fn record_ipfs_upload(provider: &str, duration: f64, success: bool) {
        let status = if success { "success" } else { "failure" };
        IPFS_UPLOADS
            .with_label_values(&[provider, status])
            .inc();

        if success {
            IPFS_UPLOAD_DURATION
                .with_label_values(&[provider])
                .observe(duration);
        }
    }

    /// 记录区块链交易
    pub fn record_blockchain_tx(tx_type: &str, duration: f64, success: bool) {
        let status = if success { "success" } else { "failure" };
        BLOCKCHAIN_TX
            .with_label_values(&[tx_type, status])
            .inc();

        if success {
            BLOCKCHAIN_TX_DURATION
                .with_label_values(&[tx_type])
                .observe(duration);
        }
    }

    /// 记录缓存命中
    pub fn record_cache_hit(cache_type: &str) {
        CACHE_HITS
            .with_label_values(&[cache_type])
            .inc();
    }

    /// 记录缓存未命中
    pub fn record_cache_miss(cache_type: &str) {
        CACHE_MISSES
            .with_label_values(&[cache_type])
            .inc();
    }

    /// 更新缓存大小
    pub fn update_cache_size(cache_type: &str, size: usize) {
        CACHE_SIZE
            .with_label_values(&[cache_type])
            .set(size as f64);
    }

    /// 记录错误
    pub fn record_error(error_type: &str, source: &str) {
        ERROR_COUNTER
            .with_label_values(&[error_type, source])
            .inc();
    }

    /// 更新内存使用
    pub fn update_memory_usage(memory_type: &str, bytes: u64) {
        MEMORY_USAGE
            .with_label_values(&[memory_type])
            .set(bytes as f64);
    }

    /// 更新CPU使用
    pub fn update_cpu_usage(core: &str, percent: f64) {
        CPU_USAGE
            .with_label_values(&[core])
            .set(percent);
    }

    /// 导出指标 (Prometheus格式)
    pub fn export_metrics() -> Result<String> {
        let encoder = TextEncoder::new();
        let metric_families = prometheus::gather();
        let mut buffer = Vec::new();
        encoder.encode(&metric_families, &mut buffer)?;
        Ok(String::from_utf8(buffer)?)
    }
}

/// HTTP server for Prometheus metrics endpoint
#[cfg(feature = "metrics_server")]
pub mod server {
    use super::*;
    use warp::Filter;

    /// 启动指标服务器
    pub async fn start_metrics_server(port: u16) {
        let metrics_route = warp::path("metrics")
            .map(|| {
                match PrometheusCollector::export_metrics() {
                    Ok(metrics) => warp::reply::with_status(
                        metrics,
                        warp::http::StatusCode::OK,
                    ),
                    Err(e) => warp::reply::with_status(
                        format!("Error: {}", e),
                        warp::http::StatusCode::INTERNAL_SERVER_ERROR,
                    ),
                }
            });

        let health_route = warp::path("health")
            .map(|| warp::reply::json(&serde_json::json!({
                "status": "healthy",
                "timestamp": chrono::Utc::now().to_rfc3339(),
            })));

        let routes = metrics_route.or(health_route);

        println!("📊 Metrics server starting on port {}", port);
        warp::serve(routes)
            .run(([0, 0, 0, 0], port))
            .await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_record_request() {
        PrometheusCollector::record_request_start("Bazi");
        PrometheusCollector::record_request_complete("Bazi", "Professional", 10.5, true);

        // 验证指标可以导出
        let metrics = PrometheusCollector::export_metrics().unwrap();
        assert!(metrics.contains("oracle_requests_total"));
    }

    #[test]
    fn test_record_ai_api_call() {
        PrometheusCollector::record_ai_api_call("deepseek-chat", 3.5, true);

        let metrics = PrometheusCollector::export_metrics().unwrap();
        assert!(metrics.contains("oracle_ai_api_calls_total"));
    }

    #[test]
    fn test_export_metrics() {
        let metrics = PrometheusCollector::export_metrics().unwrap();
        assert!(!metrics.is_empty());
        println!("{}", metrics);
    }
}
