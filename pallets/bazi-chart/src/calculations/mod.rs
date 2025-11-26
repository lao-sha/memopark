//! # 八字排盘计算模块
//!
//! 本模块包含所有八字排盘相关的计算逻辑，包括：
//! - 干支计算：干支索引转换、序列计算
//! - 四柱计算：年月日时柱的完整计算逻辑
//! - 大运计算：起运年龄、大运序列
//! - 五行计算：五行强度、喜用神分析

pub mod ganzhi;
pub mod sizhu;
pub mod dayun;
pub mod wuxing;

// 重新导出核心函数
pub use ganzhi::*;
pub use sizhu::{calculate_day_ganzhi, calculate_year_ganzhi, calculate_month_ganzhi, calculate_hour_ganzhi};
pub use dayun::{calculate_qiyun_age, calculate_dayun_list, calculate_dayun_shishen};
pub use wuxing::{calculate_wuxing_strength, determine_xiyong_shen};
