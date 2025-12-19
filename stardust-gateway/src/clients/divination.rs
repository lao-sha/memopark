// 占卜服务客户端 - 与占卜微服务通信
use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};
use std::time::Duration;

use crate::models::ApiError;

/// 占卜服务客户端
#[derive(Clone)]
pub struct DivinationClient {
    /// HTTP 客户端
    client: Client,
    /// 服务基础 URL
    base_url: String,
    /// 重试次数
    max_retries: u32,
}

impl DivinationClient {
    /// 创建新的占卜服务客户端
    pub fn new(base_url: String, timeout_secs: u64, max_retries: u32) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(timeout_secs))
            .build()
            .expect("Failed to build HTTP client");

        Self {
            client,
            base_url,
            max_retries,
        }
    }

    /// 小六壬占卜计算
    pub async fn xiaoliuren_calculate(
        &self,
        request: XiaoliurenRequest,
    ) -> Result<XiaoliurenResponse, ApiError> {
        self.post_with_retry("/api/xiaoliuren/calculate", &request)
            .await
    }

    /// 紫微斗数排盘
    pub async fn ziwei_calculate(
        &self,
        request: ZiweiRequest,
    ) -> Result<ZiweiResponse, ApiError> {
        self.post_with_retry("/api/ziwei/calculate", &request)
            .await
    }

    /// 六爻起卦
    pub async fn liuyao_calculate(
        &self,
        request: LiuyaoRequest,
    ) -> Result<LiuyaoResponse, ApiError> {
        self.post_with_retry("/api/liuyao/calculate", &request)
            .await
    }

    /// 大六壬计算
    pub async fn daliuren_calculate(
        &self,
        request: DaliurenRequest,
    ) -> Result<DaliurenResponse, ApiError> {
        self.post_with_retry("/api/daliuren/calculate", &request)
            .await
    }

    /// 奇门遁甲计算
    pub async fn qimen_calculate(
        &self,
        request: QimenRequest,
    ) -> Result<QimenResponse, ApiError> {
        self.post_with_retry("/api/qimen/calculate", &request)
            .await
    }

    /// AI 塔罗解读
    pub async fn tarot_interpret(
        &self,
        request: TarotRequest,
    ) -> Result<TarotResponse, ApiError> {
        self.post_with_retry("/api/tarot/interpret", &request)
            .await
    }

    /// 通用 POST 请求（带重试）
    async fn post_with_retry<T: Serialize, R: for<'de> Deserialize<'de>>(
        &self,
        endpoint: &str,
        payload: &T,
    ) -> Result<R, ApiError> {
        let url = format!("{}{}", self.base_url, endpoint);
        let mut retries = 0;

        loop {
            match self
                .client
                .post(&url)
                .json(payload)
                .send()
                .await
            {
                Ok(response) => {
                    let status = response.status();

                    // 成功响应
                    if status.is_success() {
                        return response.json::<R>().await.map_err(|e| {
                            ApiError::DivinationService(format!("Failed to parse response: {}", e))
                        });
                    }

                    // 服务端错误，可重试
                    if status.is_server_error() && retries < self.max_retries {
                        retries += 1;
                        tracing::warn!(
                            "Divination service error ({}), retrying {}/{}",
                            status,
                            retries,
                            self.max_retries
                        );
                        tokio::time::sleep(Duration::from_millis(100 * retries as u64)).await;
                        continue;
                    }

                    // 客户端错误或重试耗尽
                    let error_text = response.text().await.unwrap_or_default();
                    return Err(ApiError::DivinationService(format!(
                        "Request failed with status {}: {}",
                        status, error_text
                    )));
                }
                Err(e) if e.is_timeout() => {
                    return Err(ApiError::Timeout);
                }
                Err(e) if retries < self.max_retries => {
                    retries += 1;
                    tracing::warn!(
                        "Divination service connection error: {}, retrying {}/{}",
                        e,
                        retries,
                        self.max_retries
                    );
                    tokio::time::sleep(Duration::from_millis(100 * retries as u64)).await;
                }
                Err(e) => {
                    return Err(ApiError::DivinationService(format!(
                        "Failed to connect: {}",
                        e
                    )));
                }
            }
        }
    }

    /// 健康检查
    pub async fn health_check(&self) -> bool {
        let url = format!("{}/health", self.base_url);
        self.client
            .get(&url)
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false)
    }
}

// ============ 请求/响应数据结构 ============

/// 小六壬请求
#[derive(Debug, Serialize, Deserialize)]
pub struct XiaoliurenRequest {
    pub year: u32,
    pub month: u32,
    pub day: u32,
    pub hour: u32,
    pub question: String,
}

/// 小六壬响应
#[derive(Debug, Serialize, Deserialize)]
pub struct XiaoliurenResponse {
    pub course: String,          // 课体
    pub interpretation: String,  // 解读
    pub compressed_data: Vec<u8>, // 13 字节压缩数据
}

/// 紫微斗数请求
#[derive(Debug, Serialize, Deserialize)]
pub struct ZiweiRequest {
    pub birth_year: u32,
    pub birth_month: u32,
    pub birth_day: u32,
    pub birth_hour: u32,
    pub gender: String,
    pub is_leap_month: bool,
}

/// 紫微斗数响应
#[derive(Debug, Serialize, Deserialize)]
pub struct ZiweiResponse {
    pub chart: serde_json::Value, // 命盘数据
    pub analysis: String,          // 基础分析
}

/// 六爻请求
#[derive(Debug, Serialize, Deserialize)]
pub struct LiuyaoRequest {
    pub method: String,    // 起卦方式: "time" | "number" | "manual"
    pub timestamp: Option<u64>,
    pub numbers: Option<Vec<u32>>,
    pub hexagram: Option<String>,
    pub question: String,
}

/// 六爻响应
#[derive(Debug, Serialize, Deserialize)]
pub struct LiuyaoResponse {
    pub original_hexagram: String,
    pub changed_hexagram: Option<String>,
    pub interpretation: String,
}

/// 大六壬请求
#[derive(Debug, Serialize, Deserialize)]
pub struct DaliurenRequest {
    pub year: u32,
    pub month: u32,
    pub day: u32,
    pub hour: u32,
    pub question: String,
}

/// 大六壬响应
#[derive(Debug, Serialize, Deserialize)]
pub struct DaliurenResponse {
    pub four_pillars: serde_json::Value,
    pub twelve_gods: Vec<String>,
    pub interpretation: String,
}

/// 奇门遁甲请求
#[derive(Debug, Serialize, Deserialize)]
pub struct QimenRequest {
    pub year: u32,
    pub month: u32,
    pub day: u32,
    pub hour: u32,
    pub question: String,
}

/// 奇门遁甲响应
#[derive(Debug, Serialize, Deserialize)]
pub struct QimenResponse {
    pub chart: serde_json::Value,
    pub interpretation: String,
}

/// 塔罗请求
#[derive(Debug, Serialize, Deserialize)]
pub struct TarotRequest {
    pub cards: Vec<String>,
    pub spread: String,
    pub question: String,
}

/// 塔罗响应
#[derive(Debug, Serialize, Deserialize)]
pub struct TarotResponse {
    pub interpretation: String,
    pub card_meanings: Vec<CardMeaning>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CardMeaning {
    pub card: String,
    pub position: String,
    pub meaning: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore] // 需要运行中的占卜服务
    async fn test_divination_client() {
        let client = DivinationClient::new(
            "http://127.0.0.1:3001".to_string(),
            30,
            3,
        );

        assert!(client.health_check().await);
    }
}
