// 模型模块入口
pub mod error;
pub mod response;

pub use error::{ApiError, ApiResult, ErrorResponse};
pub use response::{ApiResponse, HealthResponse, PageResponse, ServiceStatus};
