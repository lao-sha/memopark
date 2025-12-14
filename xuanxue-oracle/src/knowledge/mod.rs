/// 八字知识库管理模块
///
/// 本模块负责加载和管理八字命理知识库，包括：
/// - 天干地支基础知识
/// - 五行理论
/// - 十神体系
/// - 格局理论
/// - 用神调候
/// - 解读规则
///
/// 知识库以JSON格式存储，支持缓存和动态查询

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use tracing::debug;

/// 天干信息结构
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TianganInfo {
    pub wuxing: String,
    pub yinyang: String,
    pub image: String,
    pub nature: String,
    pub personality: PersonalityTraits,
    pub body_parts: Vec<String>,
    pub health_issues: Vec<String>,
    pub career_fields: Vec<String>,
    pub season_strength: HashMap<String, SeasonPower>,
    pub relations: TianganRelations,
    pub classical_quotes: Vec<ClassicalQuote>,
    pub yongshen_preference: HashMap<String, String>,
}

/// 性格特征
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PersonalityTraits {
    pub positive: Vec<String>,
    pub negative: Vec<String>,
}

/// 季节力量
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct SeasonPower {
    pub status: String,
    pub power: u32,
}

/// 天干关系
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TianganRelations {
    #[serde(rename = "生")]
    pub sheng: Vec<String>,
    #[serde(rename = "克")]
    pub ke: Vec<String>,
    #[serde(rename = "被生")]
    pub bei_sheng: Vec<String>,
    #[serde(rename = "被克")]
    pub bei_ke: Vec<String>,
    #[serde(rename = "合")]
    pub he: String,
    #[serde(rename = "冲")]
    pub chong: String,
}

/// 经典引用
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ClassicalQuote {
    pub source: String,
    pub quote: String,
    pub meaning: String,
}

/// 地支信息结构
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct DizhiInfo {
    pub wuxing: String,
    pub yinyang: String,
    pub hidden_stems: Vec<HiddenStem>,
    pub season: String,
    pub month: String,
    pub time: String,
    pub image: String,
    pub direction: String,
    pub nature: String,
    pub body_parts: Vec<String>,
    pub relations: DizhiRelations,
    pub characteristics: String,
    pub suitable_tiangan: Vec<String>,
    pub classical_notes: String,
}

/// 藏干
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct HiddenStem {
    pub stem: String,
    pub power: u32,
}

/// 地支关系
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct DizhiRelations {
    #[serde(rename = "三合")]
    pub san_he: SanHeInfo,
    #[serde(rename = "六合")]
    pub liu_he: String,
    #[serde(rename = "六冲")]
    pub liu_chong: String,
    #[serde(rename = "六害")]
    pub liu_hai: String,
    #[serde(rename = "三刑")]
    pub san_xing: Vec<String>,
    #[serde(rename = "相破")]
    pub xiang_po: String,
}

/// 三合信息
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct SanHeInfo {
    pub element: String,
    pub members: Vec<String>,
}

/// 格局信息结构
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PatternInfo {
    pub definition: String,
    pub formation_conditions: Vec<String>,
    pub success_marks: serde_json::Value,
    pub failure_marks: serde_json::Value,
    pub personality: String,
    pub career: Vec<String>,
    pub wealth_level: String,
    pub marriage: serde_json::Value,
    pub life_level: String,
    #[serde(default)]
    pub famous_cases: Vec<String>,
    pub classical_theory: ClassicalTheory,
    pub use_god_preference: String,
}

/// 经典理论
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ClassicalTheory {
    pub source: String,
    pub quote: String,
    pub explanation: String,
}

/// 八字知识库管理器
pub struct BaziKnowledgeBase {
    /// 天干知识库
    tiangan_data: HashMap<String, TianganInfo>,
    /// 地支知识库
    dizhi_data: HashMap<String, DizhiInfo>,
    /// 五行知识库
    wuxing_data: serde_json::Value,
    /// 十神知识库
    shishen_data: serde_json::Value,
    /// 格局知识库
    pattern_data: HashMap<String, PatternInfo>,
    /// 调候用神知识库
    tiaohuo_data: serde_json::Value,
    /// 解读规则知识库
    interpretation_rules: serde_json::Value,
}

impl BaziKnowledgeBase {
    /// 创建并加载知识库
    ///
    /// # 示例
    ///
    /// ```
    /// let kb = BaziKnowledgeBase::load()?;
    /// ```
    pub fn load() -> Result<Self> {
        debug!("开始加载八字知识库");

        let tiangan_data = Self::load_json_map("knowledge/bazi/basics/tiangan.json")
            .context("加载天干知识库失败")?;

        let dizhi_data = Self::load_json_map("knowledge/bazi/basics/dizhi.json")
            .context("加载地支知识库失败")?;

        let wuxing_data = Self::load_json_value("knowledge/bazi/basics/wuxing.json")
            .context("加载五行知识库失败")?;

        let shishen_data = Self::load_json_value("knowledge/bazi/basics/shishen.json")
            .context("加载十神知识库失败")?;

        let pattern_data = Self::load_json_map("knowledge/bazi/patterns/zhengge.json")
            .context("加载格局知识库失败")?;

        let tiaohuo_data = Self::load_json_value("knowledge/bazi/yongshen/tiaohuo.json")
            .context("加载调候用神知识库失败")?;

        let interpretation_rules = Self::load_json_value("knowledge/bazi/interpretations/core_rules.json")
            .context("加载解读规则知识库失败")?;

        debug!("八字知识库加载完成");

        Ok(Self {
            tiangan_data,
            dizhi_data,
            wuxing_data,
            shishen_data,
            pattern_data,
            tiaohuo_data,
            interpretation_rules,
        })
    }

    /// 加载JSON文件并解析为HashMap
    fn load_json_map<T>(path: &str) -> Result<HashMap<String, T>>
    where
        T: for<'de> Deserialize<'de>,
    {
        let content = fs::read_to_string(path)
            .with_context(|| format!("无法读取文件: {}", path))?;

        let map: HashMap<String, T> = serde_json::from_str(&content)
            .with_context(|| format!("无法解析JSON: {}", path))?;

        Ok(map)
    }

    /// 加载JSON文件为Value
    fn load_json_value(path: &str) -> Result<serde_json::Value> {
        let content = fs::read_to_string(path)
            .with_context(|| format!("无法读取文件: {}", path))?;

        let value: serde_json::Value = serde_json::from_str(&content)
            .with_context(|| format!("无法解析JSON: {}", path))?;

        Ok(value)
    }

    /// 获取天干详细信息
    pub fn get_tiangan_info(&self, tiangan: &str) -> Option<&TianganInfo> {
        self.tiangan_data.get(tiangan)
    }

    /// 获取地支详细信息
    pub fn get_dizhi_info(&self, dizhi: &str) -> Option<&DizhiInfo> {
        self.dizhi_data.get(dizhi)
    }

    /// 获取格局理论
    pub fn get_pattern_info(&self, pattern: &str) -> Option<&PatternInfo> {
        self.pattern_data.get(pattern)
    }

    /// 获取五行信息
    pub fn get_wuxing_info(&self, wuxing: &str) -> Option<&serde_json::Value> {
        self.wuxing_data.get(wuxing)
    }

    /// 获取十神信息
    pub fn get_shishen_info(&self, shishen: &str) -> Option<&serde_json::Value> {
        self.shishen_data.get(shishen)
    }

    /// 获取调候用神建议
    pub fn get_tiaohuo_yongshen(&self, day_master: &str, season: &str) -> Option<&serde_json::Value> {
        let tiangan_key = format!("{}调候", day_master);
        self.tiaohuo_data.get(&tiangan_key)
            .and_then(|tg| tg.get(season))
    }

    /// 增强Prompt（核心功能）
    ///
    /// 根据八字数据从知识库提取相关知识，增强AI解读的准确性
    pub fn enrich_prompt(&self, base_prompt: &str, bazi_data: &serde_json::Value) -> String {
        let mut enriched = base_prompt.to_string();

        // 添加日主天干详解
        if let Some(day_master) = bazi_data["day_master"].as_str() {
            let day_tiangan = &day_master[0..3]; // 取第一个字符（UTF-8）
            if let Some(info) = self.get_tiangan_info(day_tiangan) {
                enriched.push_str("\n\n### 📚 知识库补充 - 日主特性\n");
                enriched.push_str(&format!("**五行属性**: {}\n", info.wuxing));
                enriched.push_str(&format!("**阴阳**: {}\n", info.yinyang));
                enriched.push_str(&format!("**象义**: {}\n", info.image));
                enriched.push_str(&format!("**本性**: {}\n", info.nature));
                enriched.push_str(&format!("**性格优点**: {}\n", info.personality.positive.join("、")));
                enriched.push_str(&format!("**性格缺点**: {}\n", info.personality.negative.join("、")));

                // 添加经典引用
                if let Some(quote) = info.classical_quotes.first() {
                    enriched.push_str(&format!("\n**经典理论** ({}): {}\n", quote.source, quote.quote));
                    enriched.push_str(&format!("**释义**: {}\n", quote.meaning));
                }
            }
        }

        // 添加格局理论
        if let Some(geju) = bazi_data["geju"].as_str() {
            if let Some(pattern) = self.get_pattern_info(geju) {
                enriched.push_str("\n\n### 📚 知识库补充 - 格局理论\n");
                enriched.push_str(&format!("**格局定义**: {}\n", pattern.definition));
                enriched.push_str(&format!("**人生层次**: {}\n", pattern.life_level));
                enriched.push_str(&format!("**性格特点**: {}\n", pattern.personality));
                enriched.push_str(&format!("**适合职业**: {}\n", pattern.career.join("、")));
                enriched.push_str(&format!("**经典理论** ({}): {}\n",
                    pattern.classical_theory.source, pattern.classical_theory.quote));
                enriched.push_str(&format!("**解释**: {}\n", pattern.classical_theory.explanation));
            }
        }

        // 添加用神理论
        if let Some(yongshen) = bazi_data["yongshen"].as_str() {
            enriched.push_str("\n\n### 📚 知识库补充 - 用神理论\n");
            enriched.push_str(&format!("**用神**: {}\n", yongshen));

            // 获取用神五行信息
            if let Some(wuxing_info) = self.get_wuxing_info(yongshen) {
                if let Some(career) = wuxing_info.get("career") {
                    enriched.push_str(&format!("**适合行业**: {}\n",
                        serde_json::to_string(career).unwrap_or_default()));
                }
                if let Some(color) = wuxing_info.get("color") {
                    enriched.push_str(&format!("**幸运颜色**: {}\n",
                        serde_json::to_string(color).unwrap_or_default()));
                }
            }
        }

        // 添加调候建议
        if let Some(day_master) = bazi_data["day_master"].as_str() {
            let day_tiangan = &day_master[0..3];
            // 假设从月柱推断季节
            if let Some(month_pillar) = bazi_data["month_pillar"].as_str() {
                let season = Self::infer_season_from_month(month_pillar);
                if let Some(tiaohuo) = self.get_tiaohuo_yongshen(day_tiangan, &season) {
                    enriched.push_str("\n\n### 📚 知识库补充 - 调候用神\n");
                    enriched.push_str(&format!("**季节**: {}\n", season));
                    if let Some(primary) = tiaohuo.get("primary_yongshen") {
                        enriched.push_str(&format!("**首选用神**: {}\n", primary.as_str().unwrap_or("")));
                    }
                    if let Some(reason) = tiaohuo.get("reason") {
                        enriched.push_str(&format!("**理由**: {}\n", reason.as_str().unwrap_or("")));
                    }
                    if let Some(quote) = tiaohuo.get("classical_quote") {
                        enriched.push_str(&format!("**口诀**: {}\n", quote.as_str().unwrap_or("")));
                    }
                }
            }
        }

        enriched
    }

    /// 从月柱推断季节
    fn infer_season_from_month(month_pillar: &str) -> String {
        // 提取地支
        let dizhi = if month_pillar.len() >= 6 {
            &month_pillar[3..6]
        } else {
            ""
        };

        match dizhi {
            "寅" | "卯" | "辰" => "spring",
            "巳" | "午" | "未" => "summer",
            "申" | "酉" | "戌" => "autumn",
            "亥" | "子" | "丑" => "winter",
            _ => "spring", // 默认
        }.to_string()
    }

    /// 获取解读规则
    pub fn get_interpretation_rule(&self, category: &str, key: &str) -> Option<&serde_json::Value> {
        self.interpretation_rules.get(category)
            .and_then(|cat| cat.get(key))
    }

    /// 生成知识库统计信息
    pub fn get_statistics(&self) -> String {
        format!(
            "八字知识库统计：\n\
             - 天干条目: {}\n\
             - 地支条目: {}\n\
             - 格局条目: {}\n\
             - 五行理论: 已加载\n\
             - 十神理论: 已加载\n\
             - 调候用神: 已加载\n\
             - 解读规则: 已加载",
            self.tiangan_data.len(),
            self.dizhi_data.len(),
            self.pattern_data.len()
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_load_knowledge_base() {
        let kb = BaziKnowledgeBase::load();
        assert!(kb.is_ok(), "知识库加载应该成功");

        let kb = kb.unwrap();
        assert_eq!(kb.tiangan_data.len(), 10, "应该有10个天干");
        assert_eq!(kb.dizhi_data.len(), 12, "应该有12个地支");
    }

    #[test]
    fn test_get_tiangan_info() {
        let kb = BaziKnowledgeBase::load().unwrap();
        let jia = kb.get_tiangan_info("甲");
        assert!(jia.is_some(), "应该能获取甲木信息");

        let jia = jia.unwrap();
        assert_eq!(jia.wuxing, "木");
        assert_eq!(jia.yinyang, "阳");
    }

    #[test]
    fn test_enrich_prompt() {
        let kb = BaziKnowledgeBase::load().unwrap();
        let base_prompt = "请解读以下八字";

        let bazi_data = serde_json::json!({
            "day_master": "甲木",
            "geju": "正官格",
            "yongshen": "火"
        });

        let enriched = kb.enrich_prompt(base_prompt, &bazi_data);
        assert!(enriched.contains("日主特性"), "应该包含日主特性");
        assert!(enriched.contains("格局理论"), "应该包含格局理论");
    }
}
