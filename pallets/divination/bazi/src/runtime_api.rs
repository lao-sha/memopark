//! # 八字解盘 Runtime API
//!
//! 本模块定义了八字解盘系统的 Runtime API，供前端通过 RPC 免费调用。
//!
//! ## 功能说明
//!
//! - `get_interpretation`: 获取完整解盘（唯一接口，包含核心指标+性格分析+扩展忌神）
//! - `chart_exists`: 检查命盘是否存在
//! - `get_chart_owner`: 获取命盘创建者
//! - `get_encrypted_chart_interpretation`: 获取加密命盘的解盘结果
//! - `encrypted_chart_exists`: 检查加密命盘是否存在
//! - `get_encrypted_chart_owner`: 获取加密命盘创建者
//!
//! ## 使用方式
//!
//! 前端通过 polkadot.js API 调用：
//! ```javascript
//! // 获取完整解盘
//! const result = await api.call.baziChartApi.getInterpretation(chartId);
//!
//! // 访问核心数据
//! const { geJu, qiangRuo, yongShen, score } = result.core;
//!
//! // 访问性格分析
//! const { zhuYaoTeDian, youDian } = result.xingGe;
//!
//! // 获取加密命盘的解盘
//! const encryptedResult = await api.call.baziChartApi.getEncryptedChartInterpretation(chartId);
//! ```
//!
//! ## 版本说明
//!
//! V4 版本合并了 V2/V3 的所有功能：
//! - V2 SimplifiedInterpretation → 已合并到 FullInterpretation.core
//! - V3 CoreInterpretation → 已合并到 FullInterpretation.core
//! - V3 FullInterpretation → 现为唯一返回类型
//! - 新增加密命盘支持（V4）

use crate::interpretation::FullInterpretation;
use codec::Codec;

sp_api::decl_runtime_apis! {
    /// 八字解盘 Runtime API
    ///
    /// 提供八字命盘的免费查询接口，无需支付 Gas 费用。
    ///
    /// ## 设计原则
    ///
    /// - 单一接口：只提供 `get_interpretation`，返回完整数据
    /// - 前端按需使用：只需核心数据时访问 `.core`，需要性格分析时访问 `.xing_ge`
    /// - 零成本抽象：性格分析计算开销极小（< 1μs）
    /// - 隐私保护：支持加密命盘的解盘查询
    pub trait BaziChartApi<AccountId>
    where
        AccountId: Codec,
    {
        /// 获取完整解盘（唯一接口）
        ///
        /// 返回数据结构：
        /// ```text
        /// FullInterpretation
        /// ├── core: CoreInterpretation (13 bytes)
        /// │   ├── ge_ju          格局（正格、从强格、从弱格等）
        /// │   ├── qiang_ruo      强弱（身旺、身弱、中和等）
        /// │   ├── yong_shen      用神（金、木、水、火、土）
        /// │   ├── yong_shen_type 用神类型（扶抑、调候、通关、专旺）
        /// │   ├── xi_shen        喜神
        /// │   ├── ji_shen        忌神
        /// │   ├── score          综合评分 (0-100)
        /// │   ├── confidence     可信度 (0-100)
        /// │   ├── timestamp      时间戳（区块号）
        /// │   └── algorithm_version 算法版本
        /// │
        /// ├── xing_ge: Option<CompactXingGe> (性格分析)
        /// │   ├── zhu_yao_te_dian  主要性格特点（最多3个）
        /// │   ├── you_dian         优点（最多3个）
        /// │   ├── que_dian         缺点（最多2个）
        /// │   └── shi_he_zhi_ye    适合职业（最多4个）
        /// │
        /// └── extended_ji_shen: Option<ExtendedJiShen> (扩展忌神)
        ///     └── secondary        次忌神列表（最多2个）
        /// ```
        ///
        /// # 参数
        /// - `chart_id`: 八字命盘 ID
        ///
        /// # 返回
        /// - `Some(FullInterpretation)`: 完整解盘结果
        /// - `None`: 命盘不存在
        ///
        /// # 示例
        /// ```javascript
        /// // 前端调用
        /// const result = await api.call.baziChartApi.getInterpretation(chartId);
        ///
        /// // 只需核心数据（等价于旧版 V2/V3 Core）
        /// const core = result.core;
        /// console.log(core.geJu, core.score);
        ///
        /// // 需要性格分析
        /// if (result.xingGe) {
        ///     console.log(result.xingGe.zhuYaoTeDian);
        /// }
        /// ```
        fn get_interpretation(chart_id: u64) -> Option<FullInterpretation>;

        /// 检查命盘是否存在
        ///
        /// # 参数
        /// - `chart_id`: 八字命盘 ID
        ///
        /// # 返回
        /// - `true`: 命盘存在
        /// - `false`: 命盘不存在
        fn chart_exists(chart_id: u64) -> bool;

        /// 获取命盘创建者
        ///
        /// # 参数
        /// - `chart_id`: 八字命盘 ID
        ///
        /// # 返回
        /// - `Some(AccountId)`: 命盘创建者地址
        /// - `None`: 命盘不存在
        fn get_chart_owner(chart_id: u64) -> Option<AccountId>;

        /// 获取加密命盘的完整解盘
        ///
        /// 基于加密命盘的四柱索引计算解盘，无需解密敏感数据。
        ///
        /// # 参数
        /// - `chart_id`: 加密八字命盘 ID
        ///
        /// # 返回
        /// - `Some(FullInterpretation)`: 完整解盘结果
        /// - `None`: 命盘不存在
        ///
        /// # 特点
        /// - 完全免费（无 gas 费用）
        /// - 保护用户隐私（不访问加密数据）
        /// - 基于四柱索引计算，可信度略低于完整命盘
        ///
        /// # 示例
        /// ```javascript
        /// const result = await api.call.baziChartApi.getEncryptedChartInterpretation(chartId);
        /// console.log(result.core.geJu, result.core.score);
        /// ```
        fn get_encrypted_chart_interpretation(chart_id: u64) -> Option<FullInterpretation>;

        /// 检查加密命盘是否存在
        ///
        /// # 参数
        /// - `chart_id`: 加密八字命盘 ID
        ///
        /// # 返回
        /// - `true`: 命盘存在
        /// - `false`: 命盘不存在
        fn encrypted_chart_exists(chart_id: u64) -> bool;

        /// 获取加密命盘创建者
        ///
        /// # 参数
        /// - `chart_id`: 加密八字命盘 ID
        ///
        /// # 返回
        /// - `Some(AccountId)`: 命盘创建者地址
        /// - `None`: 命盘不存在
        fn get_encrypted_chart_owner(chart_id: u64) -> Option<AccountId>;
    }
}
