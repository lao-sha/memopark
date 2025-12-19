// 占卜相关路由
use axum::{extract::State, Extension, Json};
use serde::{Deserialize, Serialize};

use crate::{
    clients::{
        DaliurenRequest, LiuyaoRequest, QimenRequest, TarotRequest, XiaoliurenRequest,
        ZiweiRequest,
    },
    middleware::Claims,
    models::{ApiError, ApiResponse},
    AppState,
};

/// 小六壬占卜
pub async fn xiaoliuren_handler(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(req): Json<XiaoliurenRequest>,
) -> Result<Json<ApiResponse<serde_json::Value>>, ApiError> {
    tracing::info!("小六壬占卜请求 - 用户: {}", claims.address);

    // 构建缓存键
    let cache_key = format!(
        "div:xiaoliuren:{}:{}:{}:{}:{}",
        req.year, req.month, req.day, req.hour, req.question
    );

    // 使用缓存或计算
    let result = state
        .cache
        .get_or_set(&cache_key, 3600, || async {
            // 调用占卜服务
            let response = state.divination.xiaoliuren_calculate(req.clone()).await?;

            // 将结果转换为 JSON
            Ok::<_, ApiError>(serde_json::json!({
                "course": response.course,
                "interpretation": response.interpretation,
                "compressed_data": hex::encode(&response.compressed_data),
            }))
        })
        .await?;

    Ok(Json(ApiResponse::success(result)))
}

/// 紫微斗数排盘
pub async fn ziwei_handler(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(req): Json<ZiweiRequest>,
) -> Result<Json<ApiResponse<serde_json::Value>>, ApiError> {
    tracing::info!("紫微斗数请求 - 用户: {}", claims.address);

    let cache_key = format!(
        "div:ziwei:{}:{}:{}:{}:{}",
        req.birth_year, req.birth_month, req.birth_day, req.birth_hour, req.gender
    );

    let result = state
        .cache
        .get_or_set(&cache_key, 7200, || async {
            let response = state.divination.ziwei_calculate(req.clone()).await?;
            Ok::<_, ApiError>(serde_json::json!({
                "chart": response.chart,
                "analysis": response.analysis,
            }))
        })
        .await?;

    Ok(Json(ApiResponse::success(result)))
}

/// 六爻起卦
pub async fn liuyao_handler(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(req): Json<LiuyaoRequest>,
) -> Result<Json<ApiResponse<serde_json::Value>>, ApiError> {
    tracing::info!("六爻起卦请求 - 用户: {}", claims.address);

    // 六爻结果不缓存（随机性）
    let response = state.divination.liuyao_calculate(req).await?;

    Ok(Json(ApiResponse::success(serde_json::json!({
        "original_hexagram": response.original_hexagram,
        "changed_hexagram": response.changed_hexagram,
        "interpretation": response.interpretation,
    }))))
}

/// 大六壬占卜
pub async fn daliuren_handler(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(req): Json<DaliurenRequest>,
) -> Result<Json<ApiResponse<serde_json::Value>>, ApiError> {
    tracing::info!("大六壬占卜请求 - 用户: {}", claims.address);

    let cache_key = format!(
        "div:daliuren:{}:{}:{}:{}",
        req.year, req.month, req.day, req.hour
    );

    let result = state
        .cache
        .get_or_set(&cache_key, 3600, || async {
            let response = state.divination.daliuren_calculate(req.clone()).await?;
            Ok::<_, ApiError>(serde_json::json!({
                "four_pillars": response.four_pillars,
                "twelve_gods": response.twelve_gods,
                "interpretation": response.interpretation,
            }))
        })
        .await?;

    Ok(Json(ApiResponse::success(result)))
}

/// 奇门遁甲
pub async fn qimen_handler(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(req): Json<QimenRequest>,
) -> Result<Json<ApiResponse<serde_json::Value>>, ApiError> {
    tracing::info!("奇门遁甲请求 - 用户: {}", claims.address);

    let cache_key = format!(
        "div:qimen:{}:{}:{}:{}",
        req.year, req.month, req.day, req.hour
    );

    let result = state
        .cache
        .get_or_set(&cache_key, 3600, || async {
            let response = state.divination.qimen_calculate(req.clone()).await?;
            Ok::<_, ApiError>(serde_json::json!({
                "chart": response.chart,
                "interpretation": response.interpretation,
            }))
        })
        .await?;

    Ok(Json(ApiResponse::success(result)))
}

/// AI 塔罗解读
pub async fn tarot_handler(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(req): Json<TarotRequest>,
) -> Result<Json<ApiResponse<serde_json::Value>>, ApiError> {
    tracing::info!("塔罗解读请求 - 用户: {}", claims.address);

    // AI 解读不缓存
    let response = state.divination.tarot_interpret(req).await?;

    Ok(Json(ApiResponse::success(serde_json::json!({
        "interpretation": response.interpretation,
        "card_meanings": response.card_meanings,
    }))))
}

/// 查询用户占卜历史
#[derive(Debug, Deserialize)]
pub struct DivinationHistoryQuery {
    pub page: Option<u32>,
    pub page_size: Option<u32>,
}

pub async fn divination_history_handler(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    axum::extract::Query(query): axum::extract::Query<DivinationHistoryQuery>,
) -> Result<Json<ApiResponse<Vec<serde_json::Value>>>, ApiError> {
    let page = query.page.unwrap_or(1);
    let page_size = query.page_size.unwrap_or(20);

    tracing::info!(
        "查询占卜历史 - 用户: {}, 页码: {}, 大小: {}",
        claims.address,
        page,
        page_size
    );

    // 从区块链查询占卜记录
    let records = state
        .substrate
        .get_divination_records(&claims.address)
        .await?;

    // 转换为 JSON
    let json_records: Vec<serde_json::Value> = records
        .into_iter()
        .map(|r| {
            serde_json::json!({
                "user": r.user,
                "type": r.divination_type,
                "result_hash": r.result_hash,
                "timestamp": r.timestamp,
            })
        })
        .collect();

    Ok(Json(ApiResponse::success(json_records)))
}
