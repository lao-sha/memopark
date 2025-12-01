//! # 玄学公共模块 Trait 定义
//!
//! 本模块定义了各玄学系统与公共服务模块之间的接口。
//!
//! ## 核心 Trait
//!
//! - `DivinationProvider` - 占卜结果提供者，用于 NFT 和 AI 模块查询占卜数据
//! - `InterpretationContextGenerator` - AI 解读上下文生成器

use crate::types::{DivinationType, InterpretationType, RarityInput};
use sp_std::vec::Vec;

/// 占卜结果提供者 Trait
///
/// 各玄学系统（梅花、八字等）需要在 Runtime 中实现此 trait，
/// 以便公共服务模块（NFT、AI、Market）能够查询占卜结果数据。
///
/// # 实现说明
///
/// 在 Runtime 中为每个玄学系统实现此 trait，然后使用组合模式
/// 创建一个统一的 Provider 供公共模块使用。
///
/// # 示例
///
/// ```ignore
/// pub struct MeihuaDivinationProvider;
///
/// impl DivinationProvider<AccountId> for MeihuaDivinationProvider {
///     fn result_exists(divination_type: DivinationType, result_id: u64) -> bool {
///         match divination_type {
///             DivinationType::Meihua => Meihua::hexagrams(result_id).is_some(),
///             _ => false,
///         }
///     }
///     // ... 其他方法
/// }
/// ```
pub trait DivinationProvider<AccountId: PartialEq> {
    /// 检查占卜结果是否存在
    ///
    /// # 参数
    /// - `divination_type`: 占卜类型
    /// - `result_id`: 结果 ID（如卦象 ID、命盘 ID）
    ///
    /// # 返回
    /// 结果是否存在
    fn result_exists(divination_type: DivinationType, result_id: u64) -> bool;

    /// 获取占卜结果的创建者账户
    ///
    /// # 参数
    /// - `divination_type`: 占卜类型
    /// - `result_id`: 结果 ID
    ///
    /// # 返回
    /// 创建者账户，如果不存在则返回 None
    fn result_creator(divination_type: DivinationType, result_id: u64) -> Option<AccountId>;

    /// 获取稀有度计算数据
    ///
    /// 各玄学系统将自身结果的特征转换为 `RarityInput`，
    /// 由统一的算法计算 NFT 稀有度。
    ///
    /// # 参数
    /// - `divination_type`: 占卜类型
    /// - `result_id`: 结果 ID
    ///
    /// # 返回
    /// 稀有度计算输入数据
    fn rarity_data(divination_type: DivinationType, result_id: u64) -> Option<RarityInput>;

    /// 获取占卜结果摘要
    ///
    /// 返回结果的序列化摘要，用于 AI 解读的输入上下文。
    ///
    /// # 参数
    /// - `divination_type`: 占卜类型
    /// - `result_id`: 结果 ID
    ///
    /// # 返回
    /// 结果摘要的字节序列（通常为 JSON 或 SCALE 编码）
    fn result_summary(divination_type: DivinationType, result_id: u64) -> Option<Vec<u8>>;

    /// 检查占卜结果是否可以铸造为 NFT
    ///
    /// 通常需要检查：
    /// 1. 结果存在
    /// 2. 未被铸造过
    /// 3. 满足铸造条件（如状态为活跃）
    ///
    /// # 参数
    /// - `divination_type`: 占卜类型
    /// - `result_id`: 结果 ID
    ///
    /// # 返回
    /// 是否可以铸造为 NFT
    fn is_nftable(divination_type: DivinationType, result_id: u64) -> bool;

    /// 标记占卜结果已被铸造为 NFT
    ///
    /// NFT 模块在成功铸造后调用此方法，
    /// 各玄学系统应记录该结果已被 NFT 化。
    ///
    /// # 参数
    /// - `divination_type`: 占卜类型
    /// - `result_id`: 结果 ID
    fn mark_as_nfted(divination_type: DivinationType, result_id: u64);

    /// 获取占卜结果的创建时间（区块号）
    ///
    /// # 参数
    /// - `divination_type`: 占卜类型
    /// - `result_id`: 结果 ID
    ///
    /// # 返回
    /// 创建时的区块号
    fn result_created_at(divination_type: DivinationType, result_id: u64) -> Option<u32> {
        // 默认实现返回 None，各系统可覆盖
        let _ = (divination_type, result_id);
        None
    }

    /// 检查账户是否拥有该占卜结果
    ///
    /// # 参数
    /// - `divination_type`: 占卜类型
    /// - `result_id`: 结果 ID
    /// - `account`: 账户
    ///
    /// # 返回
    /// 是否为所有者
    fn is_owner(
        divination_type: DivinationType,
        result_id: u64,
        account: &AccountId,
    ) -> bool {
        Self::result_creator(divination_type, result_id)
            .map(|creator| &creator == account)
            .unwrap_or(false)
    }
}

/// 空实现的占卜结果提供者
///
/// 用于测试或默认配置。
pub struct NullDivinationProvider;

impl<AccountId: PartialEq> DivinationProvider<AccountId> for NullDivinationProvider {
    fn result_exists(_: DivinationType, _: u64) -> bool {
        false
    }

    fn result_creator(_: DivinationType, _: u64) -> Option<AccountId> {
        None
    }

    fn rarity_data(_: DivinationType, _: u64) -> Option<RarityInput> {
        None
    }

    fn result_summary(_: DivinationType, _: u64) -> Option<Vec<u8>> {
        None
    }

    fn is_nftable(_: DivinationType, _: u64) -> bool {
        false
    }

    fn mark_as_nfted(_: DivinationType, _: u64) {}
}

/// AI 解读上下文生成器 Trait
///
/// 各玄学系统实现此 trait 以生成专用的 AI 解读上下文。
/// 不同的占卜类型需要不同的上下文格式以获得最佳解读效果。
///
/// # 示例
///
/// ```ignore
/// pub struct MeihuaContextGenerator;
///
/// impl InterpretationContextGenerator for MeihuaContextGenerator {
///     fn generate_context(
///         divination_type: DivinationType,
///         result_id: u64,
///         interpretation_type: InterpretationType,
///     ) -> Option<Vec<u8>> {
///         if divination_type != DivinationType::Meihua {
///             return None;
///         }
///
///         let hexagram = Meihua::hexagrams(result_id)?;
///         let context = serde_json::json!({
///             "system": "meihua",
///             "ben_gua": format_hexagram(&hexagram.ben_gua),
///             "bian_gua": format_hexagram(&hexagram.bian_gua),
///             "dong_yao": hexagram.dong_yao,
///             "interpretation_type": interpretation_type.name(),
///         });
///         Some(context.to_string().into_bytes())
///     }
/// }
/// ```
pub trait InterpretationContextGenerator {
    /// 生成 AI 解读的上下文
    ///
    /// # 参数
    /// - `divination_type`: 占卜类型
    /// - `result_id`: 结果 ID
    /// - `interpretation_type`: 解读类型
    ///
    /// # 返回
    /// 上下文 JSON 字符串的字节序列
    fn generate_context(
        divination_type: DivinationType,
        result_id: u64,
        interpretation_type: InterpretationType,
    ) -> Option<Vec<u8>>;

    /// 获取该占卜类型支持的解读类型列表
    ///
    /// # 参数
    /// - `divination_type`: 占卜类型
    ///
    /// # 返回
    /// 支持的解读类型列表
    fn supported_interpretation_types(divination_type: DivinationType) -> Vec<InterpretationType> {
        match divination_type {
            DivinationType::Meihua | DivinationType::Bazi => {
                sp_std::vec![
                    InterpretationType::Basic,
                    InterpretationType::Detailed,
                    InterpretationType::Professional,
                    InterpretationType::Career,
                    InterpretationType::Relationship,
                    InterpretationType::Health,
                    InterpretationType::Wealth,
                    InterpretationType::Education,
                    InterpretationType::Annual,
                ]
            }
            _ => {
                sp_std::vec![
                    InterpretationType::Basic,
                    InterpretationType::Detailed,
                ]
            }
        }
    }

    /// 获取解读所需的预估 token 数量
    ///
    /// 用于预估 AI 调用成本。
    ///
    /// # 参数
    /// - `divination_type`: 占卜类型
    /// - `interpretation_type`: 解读类型
    ///
    /// # 返回
    /// 预估的输出 token 数量
    fn estimated_tokens(
        divination_type: DivinationType,
        interpretation_type: InterpretationType,
    ) -> u32 {
        let _ = divination_type;
        match interpretation_type {
            InterpretationType::Basic => 500,
            InterpretationType::Detailed => 1500,
            InterpretationType::Professional => 3000,
            _ => 1000,
        }
    }
}

/// 空实现的上下文生成器
pub struct NullContextGenerator;

impl InterpretationContextGenerator for NullContextGenerator {
    fn generate_context(
        _: DivinationType,
        _: u64,
        _: InterpretationType,
    ) -> Option<Vec<u8>> {
        None
    }
}

/// NFT 元数据生成器 Trait
///
/// 用于生成 NFT 的元数据（符合 ERC721 Metadata 标准）。
pub trait NftMetadataGenerator {
    /// 生成 NFT 元数据 JSON
    ///
    /// # 参数
    /// - `divination_type`: 占卜类型
    /// - `result_id`: 结果 ID
    /// - `name`: NFT 名称
    ///
    /// # 返回
    /// 元数据 JSON 字符串的字节序列
    fn generate_metadata(
        divination_type: DivinationType,
        result_id: u64,
        name: &[u8],
    ) -> Option<Vec<u8>>;

    /// 生成 NFT 图片描述
    ///
    /// 用于 AI 图片生成的描述文本。
    ///
    /// # 参数
    /// - `divination_type`: 占卜类型
    /// - `result_id`: 结果 ID
    ///
    /// # 返回
    /// 图片生成描述
    fn generate_image_prompt(
        divination_type: DivinationType,
        result_id: u64,
    ) -> Option<Vec<u8>>;
}

/// 空实现的元数据生成器
pub struct NullMetadataGenerator;

impl NftMetadataGenerator for NullMetadataGenerator {
    fn generate_metadata(_: DivinationType, _: u64, _: &[u8]) -> Option<Vec<u8>> {
        None
    }

    fn generate_image_prompt(_: DivinationType, _: u64) -> Option<Vec<u8>> {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_null_provider() {
        type Provider = NullDivinationProvider;
        assert!(!<Provider as DivinationProvider<u64>>::result_exists(DivinationType::Meihua, 1));
        assert!(<Provider as DivinationProvider<u64>>::result_creator(DivinationType::Meihua, 1).is_none());
        assert!(<Provider as DivinationProvider<u64>>::rarity_data(DivinationType::Meihua, 1).is_none());
        assert!(!<Provider as DivinationProvider<u64>>::is_nftable(DivinationType::Meihua, 1));
    }

    #[test]
    fn test_null_context_generator() {
        assert!(NullContextGenerator::generate_context(
            DivinationType::Meihua,
            1,
            InterpretationType::Basic
        ).is_none());
    }

    #[test]
    fn test_supported_interpretation_types() {
        let meihua_types = NullContextGenerator::supported_interpretation_types(DivinationType::Meihua);
        assert_eq!(meihua_types.len(), 9);
        assert!(meihua_types.contains(&InterpretationType::Professional));

        let liuyao_types = NullContextGenerator::supported_interpretation_types(DivinationType::Liuyao);
        assert_eq!(liuyao_types.len(), 2);
        assert!(!liuyao_types.contains(&InterpretationType::Professional));
    }

    #[test]
    fn test_estimated_tokens() {
        assert_eq!(
            NullContextGenerator::estimated_tokens(DivinationType::Meihua, InterpretationType::Basic),
            500
        );
        assert_eq!(
            NullContextGenerator::estimated_tokens(DivinationType::Bazi, InterpretationType::Professional),
            3000
        );
    }
}
