use anyhow::Result;
use std::fs;
use std::path::Path;

use crate::blockchain::types::{DivinationType, InterpretationType};
use crate::error::OracleError;

/// Prompt构造器
pub struct PromptBuilder {
    template_cache: std::collections::HashMap<String, String>,
}

impl PromptBuilder {
    /// 创建新的Prompt构造器
    pub fn new() -> Self {
        Self {
            template_cache: std::collections::HashMap::new(),
        }
    }

    /// 构造Prompt
    pub fn build_prompt(
        &mut self,
        divination_type: DivinationType,
        interpretation_type: InterpretationType,
        data: &serde_json::Value,
    ) -> Result<String> {
        match divination_type {
            DivinationType::Bazi => self.build_bazi_prompt(interpretation_type, data),
            DivinationType::Meihua => self.build_meihua_prompt(interpretation_type, data),
            DivinationType::Liuyao => self.build_liuyao_prompt(interpretation_type, data),
            _ => Err(OracleError::UnsupportedDivinationType(format!("{:?}", divination_type)).into()),
        }
    }

    /// 构造八字Prompt
    fn build_bazi_prompt(
        &mut self,
        interpretation_type: InterpretationType,
        data: &serde_json::Value,
    ) -> Result<String> {
        // 加载模板
        let template_path = format!("prompts/bazi/{:?}.txt", interpretation_type).to_lowercase();
        let template = self.load_template(&template_path)?;

        // 提取八字数据
        let year_pillar = data["year_pillar"].as_str().unwrap_or("未知");
        let month_pillar = data["month_pillar"].as_str().unwrap_or("未知");
        let day_pillar = data["day_pillar"].as_str().unwrap_or("未知");
        let hour_pillar = data["hour_pillar"].as_str().unwrap_or("未知");
        let day_master = data["day_master"].as_str().unwrap_or("未知");
        let gender = data["gender"].as_str().unwrap_or("未知");

        // 五行分析
        let wuxing_analysis = self.format_wuxing_analysis(data);

        // 十神分析
        let shishen_analysis = self.format_shishen_analysis(data);

        // 格局信息
        let geju = data["geju"].as_str().unwrap_or("未知");
        let qiangruo = data["qiangruo"].as_str().unwrap_or("未知");
        let yongshen = data["yongshen"].as_str().unwrap_or("未知");
        let jishen = data["jishen"]
            .as_array()
            .map(|arr| arr.iter()
                .filter_map(|v| v.as_str())
                .collect::<Vec<_>>()
                .join(", "))
            .unwrap_or_else(|| "未知".to_string());

        // 替换占位符
        let prompt = template
            .replace("{year_pillar}", year_pillar)
            .replace("{month_pillar}", month_pillar)
            .replace("{day_pillar}", day_pillar)
            .replace("{hour_pillar}", hour_pillar)
            .replace("{day_master}", day_master)
            .replace("{gender}", gender)
            .replace("{wuxing_analysis}", &wuxing_analysis)
            .replace("{shishen_analysis}", &shishen_analysis)
            .replace("{geju}", geju)
            .replace("{qiangruo}", qiangruo)
            .replace("{yongshen}", yongshen)
            .replace("{jishen}", &jishen);

        Ok(prompt)
    }

    /// 构造梅花易数Prompt
    fn build_meihua_prompt(
        &mut self,
        interpretation_type: InterpretationType,
        data: &serde_json::Value,
    ) -> Result<String> {
        let template_path = format!("prompts/meihua/{:?}.txt", interpretation_type).to_lowercase();
        let template = self.load_template(&template_path)?;

        // 提取梅花数据
        let ben_gua = data["ben_gua"].as_str().unwrap_or("未知");
        let bian_gua = data["bian_gua"].as_str().unwrap_or("未知");
        let dong_yao = data["dong_yao"].as_str().unwrap_or("未知");
        let ti_gua = data["ti_gua"].as_str().unwrap_or("未知");
        let yong_gua = data["yong_gua"].as_str().unwrap_or("未知");

        let prompt = template
            .replace("{ben_gua}", ben_gua)
            .replace("{bian_gua}", bian_gua)
            .replace("{dong_yao}", dong_yao)
            .replace("{ti_gua}", ti_gua)
            .replace("{yong_gua}", yong_gua);

        Ok(prompt)
    }

    /// 构造六爻Prompt
    fn build_liuyao_prompt(
        &mut self,
        interpretation_type: InterpretationType,
        data: &serde_json::Value,
    ) -> Result<String> {
        let template_path = format!("prompts/liuyao/{:?}.txt", interpretation_type).to_lowercase();
        let template = self.load_template(&template_path)?;

        // TODO: 提取六爻数据并替换

        Ok(template)
    }

    /// 加载模板
    fn load_template(&mut self, path: &str) -> Result<String> {
        // 检查缓存
        if let Some(template) = self.template_cache.get(path) {
            return Ok(template.clone());
        }

        // 从文件加载
        if Path::new(path).exists() {
            let template = fs::read_to_string(path)
                .map_err(|e| OracleError::PromptGeneration(format!("Failed to load template {}: {}", path, e)))?;

            // 缓存
            self.template_cache.insert(path.to_string(), template.clone());

            Ok(template)
        } else {
            // 如果模板文件不存在,使用默认模板
            Ok(self.get_default_template(path))
        }
    }

    /// 获取默认模板
    fn get_default_template(&self, path: &str) -> String {
        if path.contains("bazi") {
            include_str!("../../prompts/bazi/default.txt").to_string()
        } else if path.contains("meihua") {
            include_str!("../../prompts/meihua/default.txt").to_string()
        } else {
            "System: 你是专业的命理师。\n\nUser: 请提供解读。".to_string()
        }
    }

    /// 格式化五行分析
    fn format_wuxing_analysis(&self, data: &serde_json::Value) -> String {
        let wuxing = &data["wuxing_strength"];
        if wuxing.is_null() {
            return "五行数据未提供".to_string();
        }

        format!(
            "- 金: {} ({}%)\n- 木: {} ({}%)\n- 水: {} ({}%)\n- 火: {} ({}%)\n- 土: {} ({}%)",
            wuxing["jin"].as_u64().unwrap_or(0),
            wuxing["jin_percent"].as_u64().unwrap_or(0),
            wuxing["mu"].as_u64().unwrap_or(0),
            wuxing["mu_percent"].as_u64().unwrap_or(0),
            wuxing["shui"].as_u64().unwrap_or(0),
            wuxing["shui_percent"].as_u64().unwrap_or(0),
            wuxing["huo"].as_u64().unwrap_or(0),
            wuxing["huo_percent"].as_u64().unwrap_or(0),
            wuxing["tu"].as_u64().unwrap_or(0),
            wuxing["tu_percent"].as_u64().unwrap_or(0),
        )
    }

    /// 格式化十神分析
    fn format_shishen_analysis(&self, data: &serde_json::Value) -> String {
        let shishen = &data["shishen"];
        if shishen.is_null() {
            return "十神数据未提供".to_string();
        }

        // TODO: 根据实际十神数据结构格式化
        "十神配置详细分析".to_string()
    }
}
