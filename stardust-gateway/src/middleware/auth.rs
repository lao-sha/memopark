// 认证中间件 - JWT 验证
use axum::{
    body::Body,
    extract::{Request, State},
    http::header,
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{decode, DecodingKey, Validation};
use serde::{Deserialize, Serialize};

use crate::{config::Config, models::ApiError};

/// JWT Claims 结构
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    /// 用户 ID
    pub sub: String,
    /// 用户地址（Substrate 账户）
    pub address: String,
    /// 过期时间戳
    pub exp: i64,
    /// 签发时间戳
    pub iat: i64,
}

/// 认证中间件
pub async fn auth_middleware(
    State(config): State<Config>,
    mut request: Request<Body>,
    next: Next,
) -> Result<Response, ApiError> {
    // 从 Header 中提取 Token
    let auth_header = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .ok_or_else(|| ApiError::Unauthorized("Missing authorization header".to_string()))?;

    // 验证 Bearer 格式
    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or_else(|| ApiError::Unauthorized("Invalid authorization format".to_string()))?;

    // 验证 JWT
    let claims = verify_token(token, &config.auth.jwt_secret)?;

    // 将 Claims 注入请求扩展中，供后续 Handler 使用
    request.extensions_mut().insert(claims);

    Ok(next.run(request).await)
}

/// 验证 JWT Token
fn verify_token(token: &str, secret: &str) -> Result<Claims, ApiError> {
    let decoding_key = DecodingKey::from_secret(secret.as_bytes());
    let validation = Validation::default();

    decode::<Claims>(token, &decoding_key, &validation)
        .map(|data| data.claims)
        .map_err(|e| ApiError::Unauthorized(format!("Invalid token: {}", e)))
}

/// 可选认证中间件（Token 无效也允许通过，但不注入 Claims）
pub async fn optional_auth_middleware(
    State(config): State<Config>,
    mut request: Request<Body>,
    next: Next,
) -> Result<Response, ApiError> {
    if let Some(auth_header) = request.headers().get(header::AUTHORIZATION) {
        if let Ok(header_str) = auth_header.to_str() {
            if let Some(token) = header_str.strip_prefix("Bearer ") {
                if let Ok(claims) = verify_token(token, &config.auth.jwt_secret) {
                    request.extensions_mut().insert(claims);
                }
            }
        }
    }

    Ok(next.run(request).await)
}

#[cfg(test)]
mod tests {
    use super::*;
    use jsonwebtoken::{encode, EncodingKey, Header};

    #[test]
    fn test_verify_token() {
        let secret = "test_secret";
        let claims = Claims {
            sub: "user123".to_string(),
            address: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY".to_string(),
            exp: (chrono::Utc::now() + chrono::Duration::hours(1)).timestamp(),
            iat: chrono::Utc::now().timestamp(),
        };

        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(secret.as_bytes()),
        )
        .unwrap();

        let verified = verify_token(&token, secret);
        assert!(verified.is_ok());
        assert_eq!(verified.unwrap().sub, "user123");
    }
}
