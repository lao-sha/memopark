pub mod deepseek;
pub mod prompt_builder;

use anyhow::Result;
use serde::{Deserialize, Serialize};

use crate::config::DeepSeekConfig;
use crate::blockchain::types::{DivinationType, InterpretationType};

pub use deepseek::DeepSeekClient;
pub use prompt_builder::PromptBuilder;

/// AI生成的解读结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InterpretationContent {
    pub version: String,
    pub request_id: Option<u64>,
    pub divination_type: String,
    pub interpretation_type: String,
    pub generated_at: String,
    pub model: ModelInfo,
    pub content: ContentSections,
    pub metadata: Metadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub provider: String,
    pub model_id: String,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentSections {
    pub summary: String,
    pub sections: Vec<Section>,
    pub recommendations: Option<Vec<String>>,
    pub lucky_elements: Option<Vec<String>>,
    pub unlucky_elements: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Section {
    pub title: String,
    pub content: String,
    pub keywords: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Metadata {
    pub word_count: usize,
    pub reading_time_minutes: u32,
    pub confidence_score: Option<f32>,
}

/// AI服务
pub struct AiService {
    deepseek_client: DeepSeekClient,
    prompt_builder: PromptBuilder,
}

impl AiService {
    /// 创建新的AI服务
    pub fn new(config: DeepSeekConfig) -> Result<Self> {
        let deepseek_client = DeepSeekClient::new(config);
        let prompt_builder = PromptBuilder::new()?;

        Ok(Self {
            deepseek_client,
            prompt_builder,
        })
    }

    /// 生成解读
    pub async fn generate_interpretation(
        &mut self,
        divination_type: DivinationType,
        interpretation_type: InterpretationType,
        divination_data: &serde_json::Value,
    ) -> Result<InterpretationContent> {
        // 1. 构造Prompt
        let prompt = self.prompt_builder.build_prompt(
            divination_type,
            interpretation_type,
            divination_data,
        )?;

        // 2. 调用AI生成
        let raw_response = self.deepseek_client.generate(&prompt).await?;

        // 3. 解析响应并结构化
        let content = self.parse_response(
            divination_type,
            interpretation_type,
            &raw_response,
        )?;

        Ok(content)
    }

    /// 解析AI响应
    fn parse_response(
        &self,
        divination_type: DivinationType,
        interpretation_type: InterpretationType,
        raw_response: &str,
    ) -> Result<InterpretationContent> {
        // 提取各个章节
        let sections = self.extract_sections(raw_response);

        // 生成摘要
        let summary = self.generate_summary(&sections);

        // 提取关键词
        let (lucky, unlucky) = self.extract_elements(divination_type, &sections);

        // 计算元数据
        let word_count = raw_response.chars().count();
        let reading_time = (word_count / 400) as u32 + 1; // 假设每分钟400字

        Ok(InterpretationContent {
            version: "1.0".to_string(),
            request_id: None,
            divination_type: format!("{:?}", divination_type),
            interpretation_type: format!("{:?}", interpretation_type),
            generated_at: chrono::Utc::now().to_rfc3339(),
            model: ModelInfo {
                provider: "deepseek".to_string(),
                model_id: "deepseek-chat".to_string(),
                version: "v2.5".to_string(),
            },
            content: ContentSections {
                summary,
                sections,
                recommendations: None,
                lucky_elements: lucky,
                unlucky_elements: unlucky,
            },
            metadata: Metadata {
                word_count,
                reading_time_minutes: reading_time,
                confidence_score: Some(0.85),
            },
        })
    }

    /// 提取markdown章节
    fn extract_sections(&self, text: &str) -> Vec<Section> {
        let mut sections = Vec::new();
        let lines: Vec<&str> = text.lines().collect();

        let mut current_title = String::new();
        let mut current_content = String::new();

        for line in lines {
            if line.starts_with("### ") {
                // 保存上一个章节
                if !current_title.is_empty() {
                    sections.push(Section {
                        title: current_title.clone(),
                        content: current_content.trim().to_string(),
                        keywords: None,
                    });
                }

                // 开始新章节
                current_title = line.trim_start_matches("### ").to_string();
                current_content = String::new();
            } else if !line.trim().is_empty() {
                current_content.push_str(line);
                current_content.push('\n');
            }
        }

        // 保存最后一个章节
        if !current_title.is_empty() {
            sections.push(Section {
                title: current_title,
                content: current_content.trim().to_string(),
                keywords: None,
            });
        }

        sections
    }

    /// 生成摘要
    fn generate_summary(&self, sections: &[Section]) -> String {
        if let Some(first_section) = sections.first() {
            // 取第一段作为摘要
            first_section.content
                .lines()
                .take(2)
                .collect::<Vec<_>>()
                .join(" ")
        } else {
            "暂无摘要".to_string()
        }
    }

    /// 提取五行元素
    fn extract_elements(&self, divination_type: DivinationType, sections: &[Section]) -> (Option<Vec<String>>, Option<Vec<String>>) {
        if divination_type == DivinationType::Bazi {
            // 从内容中提取用神和忌神
            let mut lucky = Vec::new();
            let mut unlucky = Vec::new();

            for section in sections {
                if section.content.contains("用神") {
                    // 简单的关键词匹配
                    for element in &["金", "木", "水", "火", "土"] {
                        if section.content.contains(&format!("用神：{}", element)) {
                            lucky.push(element.to_string());
                        }
                        if section.content.contains(&format!("忌神：{}", element)) {
                            unlucky.push(element.to_string());
                        }
                    }
                }
            }

            (
                if lucky.is_empty() { None } else { Some(lucky) },
                if unlucky.is_empty() { None } else { Some(unlucky) },
            )
        } else {
            (None, None)
        }
    }
}
