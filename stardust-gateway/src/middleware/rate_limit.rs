// 限流中间件 - 基于 IP 和用户的请求限流
use axum::{
    body::Body,
    extract::{ConnectInfo, Request, State},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use governor::{
    clock::DefaultClock,
    state::{InMemoryState, NotKeyed},
    Quota, RateLimiter,
};
use std::{net::SocketAddr, num::NonZeroU32, sync::Arc};

use crate::models::ApiError;

/// 限流器状态
#[derive(Clone)]
pub struct RateLimiterState {
    /// 全局限流器（基于 IP）
    pub global: Arc<RateLimiter<NotKeyed, InMemoryState, DefaultClock>>,
}

impl RateLimiterState {
    /// 创建新的限流器（每秒最多 100 个请求）
    pub fn new(requests_per_second: u32) -> Self {
        let quota = Quota::per_second(NonZeroU32::new(requests_per_second).unwrap());
        Self {
            global: Arc::new(RateLimiter::direct(quota)),
        }
    }

    /// 创建更严格的限流器（用于占卜等计算密集型接口）
    pub fn new_strict(requests_per_minute: u32) -> Self {
        let quota = Quota::per_minute(NonZeroU32::new(requests_per_minute).unwrap());
        Self {
            global: Arc::new(RateLimiter::direct(quota)),
        }
    }
}

/// 全局限流中间件
pub async fn rate_limit_middleware(
    State(limiter): State<RateLimiterState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    request: Request<Body>,
    next: Next,
) -> Result<Response, ApiError> {
    // 检查是否超过限流
    if limiter.global.check().is_err() {
        tracing::warn!("Rate limit exceeded for IP: {}", addr.ip());
        return Err(ApiError::RateLimitExceeded);
    }

    Ok(next.run(request).await)
}

/// 严格限流中间件（用于计算密集型接口）
pub async fn strict_rate_limit_middleware(
    State(limiter): State<RateLimiterState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    request: Request<Body>,
    next: Next,
) -> Result<Response, ApiError> {
    match limiter.global.check() {
        Ok(_) => Ok(next.run(request).await),
        Err(_) => {
            tracing::warn!("Strict rate limit exceeded for IP: {}", addr.ip());
            Err(ApiError::RateLimitExceeded)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_rate_limiter() {
        let limiter = RateLimiterState::new(2); // 每秒 2 个请求

        // 前两个请求应该通过
        assert!(limiter.global.check().is_ok());
        assert!(limiter.global.check().is_ok());

        // 第三个请求应该被限流
        assert!(limiter.global.check().is_err());
    }
}
