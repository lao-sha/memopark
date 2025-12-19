// 错误处理模块 - 统一错误类型和错误响应
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use std::fmt;

/// API 错误类型
#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    /// 内部服务器错误
    #[error("Internal server error: {0}")]
    Internal(String),

    /// 请求参数错误
    #[error("Bad request: {0}")]
    BadRequest(String),

    /// 未授权
    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    /// 禁止访问
    #[error("Forbidden: {0}")]
    Forbidden(String),

    /// 资源未找到
    #[error("Not found: {0}")]
    NotFound(String),

    /// 请求超时
    #[error("Request timeout")]
    Timeout,

    /// 区块链错误
    #[error("Blockchain error: {0}")]
    Blockchain(String),

    /// 缓存错误
    #[error("Cache error: {0}")]
    Cache(String),

    /// 占卜服务错误
    #[error("Divination service error: {0}")]
    DivinationService(String),

    /// 限流错误
    #[error("Rate limit exceeded")]
    RateLimitExceeded,

    /// 数据验证错误
    #[error("Validation error: {0}")]
    Validation(String),
}

/// 错误响应结构
#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    /// 错误代码
    pub code: String,
    /// 错误信息
    pub message: String,
    /// 详细信息（可选）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

impl ApiError {
    /// 获取 HTTP 状态码
    pub fn status_code(&self) -> StatusCode {
        match self {
            ApiError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
            ApiError::BadRequest(_) | ApiError::Validation(_) => StatusCode::BAD_REQUEST,
            ApiError::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            ApiError::Forbidden(_) => StatusCode::FORBIDDEN,
            ApiError::NotFound(_) => StatusCode::NOT_FOUND,
            ApiError::Timeout => StatusCode::REQUEST_TIMEOUT,
            ApiError::RateLimitExceeded => StatusCode::TOO_MANY_REQUESTS,
            ApiError::Blockchain(_)
            | ApiError::Cache(_)
            | ApiError::DivinationService(_) => StatusCode::BAD_GATEWAY,
        }
    }

    /// 获取错误代码
    pub fn error_code(&self) -> &str {
        match self {
            ApiError::Internal(_) => "INTERNAL_ERROR",
            ApiError::BadRequest(_) => "BAD_REQUEST",
            ApiError::Unauthorized(_) => "UNAUTHORIZED",
            ApiError::Forbidden(_) => "FORBIDDEN",
            ApiError::NotFound(_) => "NOT_FOUND",
            ApiError::Timeout => "TIMEOUT",
            ApiError::Blockchain(_) => "BLOCKCHAIN_ERROR",
            ApiError::Cache(_) => "CACHE_ERROR",
            ApiError::DivinationService(_) => "DIVINATION_SERVICE_ERROR",
            ApiError::RateLimitExceeded => "RATE_LIMIT_EXCEEDED",
            ApiError::Validation(_) => "VALIDATION_ERROR",
        }
    }

    /// 转换为错误响应
    pub fn to_error_response(&self) -> ErrorResponse {
        ErrorResponse {
            code: self.error_code().to_string(),
            message: self.to_string(),
            details: None,
        }
    }
}

// 实现 IntoResponse trait，使 ApiError 可以直接作为 Axum 响应返回
impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status = self.status_code();
        let body = self.to_error_response();

        // 记录错误日志
        match self {
            ApiError::Internal(ref msg) => {
                tracing::error!("Internal error: {}", msg);
            }
            ApiError::Blockchain(ref msg) => {
                tracing::warn!("Blockchain error: {}", msg);
            }
            _ => {
                tracing::debug!("API error: {:?}", self);
            }
        }

        (status, Json(body)).into_response()
    }
}

// 从其他错误类型转换
impl From<redis::RedisError> for ApiError {
    fn from(err: redis::RedisError) -> Self {
        ApiError::Cache(err.to_string())
    }
}

impl From<reqwest::Error> for ApiError {
    fn from(err: reqwest::Error) -> Self {
        if err.is_timeout() {
            ApiError::Timeout
        } else {
            ApiError::DivinationService(err.to_string())
        }
    }
}

impl From<serde_json::Error> for ApiError {
    fn from(err: serde_json::Error) -> Self {
        ApiError::BadRequest(format!("JSON parse error: {}", err))
    }
}

impl From<anyhow::Error> for ApiError {
    fn from(err: anyhow::Error) -> Self {
        ApiError::Internal(err.to_string())
    }
}

/// API Result 类型别名
pub type ApiResult<T> = Result<T, ApiError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_status_codes() {
        assert_eq!(
            ApiError::NotFound("test".to_string()).status_code(),
            StatusCode::NOT_FOUND
        );
        assert_eq!(
            ApiError::Unauthorized("test".to_string()).status_code(),
            StatusCode::UNAUTHORIZED
        );
    }

    #[test]
    fn test_error_codes() {
        assert_eq!(
            ApiError::BadRequest("test".to_string()).error_code(),
            "BAD_REQUEST"
        );
        assert_eq!(
            ApiError::RateLimitExceeded.error_code(),
            "RATE_LIMIT_EXCEEDED"
        );
    }
}
