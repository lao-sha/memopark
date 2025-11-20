//! # 申诉域定义模块
//!
//! 定义所有支持的申诉域常量和域相关工具函数
//!
//! ## 版本历史
//! - v0.1.0 (2025-01-14): 初始版本，支持Domain 1-6
//! - v0.2.0 (2025-01-15): 新增Domain 7（作品域）

/// 域常量定义模块
pub mod domains {
    /// Domain 1: 墓地域
    pub const GRAVE: u8 = 1;

    /// Domain 2: 逝者档案域
    pub const DECEASED: u8 = 2;

    /// Domain 3: 逝者文本域
    pub const DECEASED_TEXT: u8 = 3;

    /// Domain 4: 逝者媒体域
    pub const DECEASED_MEDIA: u8 = 4;

    /// Domain 5: 供奉品域
    pub const OFFERINGS: u8 = 5;

    /// Domain 6: 园区域
    pub const PARK: u8 = 6;

    /// 🆕 Domain 7: 作品域（新增）
    ///
    /// 用途：
    /// - 针对逝者生前创作的各类作品进行独立投诉
    /// - 支持精确定位到具体作品（work_id）
    /// - 与逝者档案投诉分离，避免误伤合法作品
    pub const WORKS: u8 = 7;
}

/// 函数级中文注释：获取域的人类可读名称
///
/// ## 用途
/// - 日志记录时使用
/// - 前端展示域名称
/// - 错误消息中的域描述
///
/// ## 参数
/// - `domain`: 域ID（1-7）
///
/// ## 返回
/// - `&'static str`: 域名称字符串
///
/// ## 示例
/// ```ignore
/// let name = get_domain_name(domains::WORKS);
/// assert_eq!(name, "Works");
/// ```
pub fn get_domain_name(domain: u8) -> &'static str {
    match domain {
        domains::GRAVE => "Grave",
        domains::DECEASED => "Deceased",
        domains::DECEASED_TEXT => "DeceasedText",
        domains::DECEASED_MEDIA => "DeceasedMedia",
        domains::OFFERINGS => "Offerings",
        domains::PARK => "Park",
        domains::WORKS => "Works",  // 🆕
        _ => "Unknown",
    }
}

/// 函数级中文注释：验证域ID是否有效
///
/// ## 用途
/// - 在接收用户输入的域ID时进行验证
/// - 防止无效域ID导致的错误
///
/// ## 参数
/// - `domain`: 要验证的域ID
///
/// ## 返回
/// - `bool`: true表示有效域，false表示无效域
///
/// ## 示例
/// ```ignore
/// assert!(is_valid_domain(domains::WORKS));
/// assert!(!is_valid_domain(99));
/// ```
pub fn is_valid_domain(domain: u8) -> bool {
    matches!(
        domain,
        domains::GRAVE
            | domains::DECEASED
            | domains::DECEASED_TEXT
            | domains::DECEASED_MEDIA
            | domains::OFFERINGS
            | domains::PARK
            | domains::WORKS  // 🆕
    )
}

/// 函数级中文注释：获取所有支持的域列表
///
/// ## 用途
/// - 前端展示所有可用域
/// - 配置验证
/// - 统计分析
///
/// ## 返回
/// - `Vec<u8>`: 所有有效域ID的列表
///
/// ## 示例
/// ```ignore
/// let all = get_all_domains();
/// assert_eq!(all.len(), 7);
/// assert!(all.contains(&domains::WORKS));
/// ```
pub fn get_all_domains() -> alloc::vec::Vec<u8> {
    alloc::vec![
        domains::GRAVE,
        domains::DECEASED,
        domains::DECEASED_TEXT,
        domains::DECEASED_MEDIA,
        domains::OFFERINGS,
        domains::PARK,
        domains::WORKS,  // 🆕
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_domain_names() {
        assert_eq!(get_domain_name(domains::GRAVE), "Grave");
        assert_eq!(get_domain_name(domains::DECEASED), "Deceased");
        assert_eq!(get_domain_name(domains::WORKS), "Works");
        assert_eq!(get_domain_name(99), "Unknown");
    }

    #[test]
    fn test_domain_validation() {
        assert!(is_valid_domain(domains::GRAVE));
        assert!(is_valid_domain(domains::DECEASED));
        assert!(is_valid_domain(domains::WORKS));
        assert!(!is_valid_domain(0));
        assert!(!is_valid_domain(99));
    }

    #[test]
    fn test_all_domains_contains_works() {
        let all_domains = get_all_domains();
        assert!(all_domains.contains(&domains::WORKS));
        assert_eq!(all_domains.len(), 7);
    }

    #[test]
    fn test_all_domains_are_valid() {
        for domain in get_all_domains() {
            assert!(is_valid_domain(domain));
        }
    }
}
