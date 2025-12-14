//! # 奇门遁甲 Runtime API
//!
//! 本模块定义了奇门遁甲解卦的 Runtime API，供前端通过 RPC 调用。
//!
//! ## API 列表
//!
//! 1. `get_core_interpretation` - 获取核心解卦
//! 2. `get_full_interpretation` - 获取完整解卦
//! 3. `get_palace_interpretation` - 获取单宫详细解读
//! 4. `get_yong_shen_analysis` - 获取用神分析
//! 5. `get_ying_qi_analysis` - 获取应期推算
//!
//! ## 使用示例
//!
//! ```javascript
//! // 前端调用示例
//! const api = await ApiPromise.create({ provider: wsProvider });
//! const result = await api.call.qimenInterpretationApi.getCoreInterpretation(chartId);
//! ```

use crate::interpretation::*;
use crate::types::*;

sp_api::decl_runtime_apis! {
    /// 奇门遁甲解卦 Runtime API
    ///
    /// 提供实时计算的解卦功能，无需链上存储
    pub trait QimenInterpretationApi {
        /// 获取核心解卦
        ///
        /// # 参数
        ///
        /// - `chart_id`: 排盘记录 ID
        ///
        /// # 返回
        ///
        /// 核心解卦结果，如果排盘不存在返回 None
        fn get_core_interpretation(chart_id: u64) -> Option<QimenCoreInterpretation>;

        /// 获取完整解卦
        ///
        /// # 参数
        ///
        /// - `chart_id`: 排盘记录 ID
        /// - `question_type`: 问事类型
        ///
        /// # 返回
        ///
        /// 完整解卦结果，如果排盘不存在返回 None
        fn get_full_interpretation(
            chart_id: u64,
            question_type: QuestionType,
        ) -> Option<QimenFullInterpretation>;

        /// 获取单宫详细解读
        ///
        /// # 参数
        ///
        /// - `chart_id`: 排盘记录 ID
        /// - `palace_num`: 宫位数字（1-9）
        ///
        /// # 返回
        ///
        /// 单宫详细解读，如果排盘不存在或宫位无效返回 None
        fn get_palace_interpretation(
            chart_id: u64,
            palace_num: u8,
        ) -> Option<PalaceInterpretation>;

        /// 获取用神分析
        ///
        /// # 参数
        ///
        /// - `chart_id`: 排盘记录 ID
        /// - `question_type`: 问事类型
        ///
        /// # 返回
        ///
        /// 用神分析结果，如果排盘不存在返回 None
        fn get_yong_shen_analysis(
            chart_id: u64,
            question_type: QuestionType,
        ) -> Option<YongShenAnalysis>;

        /// 获取应期推算
        ///
        /// # 参数
        ///
        /// - `chart_id`: 排盘记录 ID
        ///
        /// # 返回
        ///
        /// 应期推算结果，如果排盘不存在返回 None
        fn get_ying_qi_analysis(chart_id: u64) -> Option<YingQiAnalysis>;
    }
}
