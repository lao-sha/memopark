// 响应模型模块 - 统一 API 响应格式
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;

/// 标准成功响应
#[derive(Debug, Serialize)]
pub struct ApiResponse<T: Serialize> {
    /// 是否成功
    pub success: bool,
    /// 响应数据
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    /// 响应消息
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    /// 时间戳
    pub timestamp: i64,
}

impl<T: Serialize> ApiResponse<T> {
    /// 创建成功响应
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            message: None,
            timestamp: chrono::Utc::now().timestamp(),
        }
    }

    /// 创建带消息的成功响应
    pub fn success_with_message(data: T, message: impl Into<String>) -> Self {
        Self {
            success: true,
            data: Some(data),
            message: Some(message.into()),
            timestamp: chrono::Utc::now().timestamp(),
        }
    }

    /// 创建空成功响应
    pub fn empty() -> ApiResponse<()> {
        ApiResponse {
            success: true,
            data: None,
            message: None,
            timestamp: chrono::Utc::now().timestamp(),
        }
    }
}

impl<T: Serialize> IntoResponse for ApiResponse<T> {
    fn into_response(self) -> Response {
        (StatusCode::OK, Json(self)).into_response()
    }
}

/// 分页响应
#[derive(Debug, Serialize)]
pub struct PageResponse<T: Serialize> {
    /// 数据列表
    pub items: Vec<T>,
    /// 当前页码（从 1 开始）
    pub page: u32,
    /// 每页大小
    pub page_size: u32,
    /// 总记录数
    pub total: u64,
    /// 总页数
    pub total_pages: u32,
}

impl<T: Serialize> PageResponse<T> {
    /// 创建分页响应
    pub fn new(items: Vec<T>, page: u32, page_size: u32, total: u64) -> Self {
        let total_pages = ((total as f64) / (page_size as f64)).ceil() as u32;
        Self {
            items,
            page,
            page_size,
            total,
            total_pages,
        }
    }
}

/// 健康检查响应
#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
    pub uptime: u64,
    pub services: ServiceStatus,
}

#[derive(Debug, Serialize)]
pub struct ServiceStatus {
    pub substrate: bool,
    pub redis: bool,
    pub divination: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_success_response() {
        let resp = ApiResponse::success("test data");
        assert!(resp.success);
        assert_eq!(resp.data, Some("test data"));
    }

    #[test]
    fn test_page_response() {
        let items = vec![1, 2, 3];
        let page_resp = PageResponse::new(items, 1, 10, 23);
        assert_eq!(page_resp.total_pages, 3);
    }
}
