// 占卜类型枚举
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DivinationType {
    Meihua = 0,
    Bazi = 1,
    Liuyao = 2,
    Qimen = 3,
    Ziwei = 4,
    Taiyi = 5,
    Daliuren = 6,
    XiaoLiuRen = 7,
    Tarot = 8,
}

// 解读类型枚举
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InterpretationType {
    Basic = 0,
    Detailed = 1,
    Professional = 2,
    Career = 3,
    Relationship = 4,
    Health = 5,
    Wealth = 6,
    Education = 7,
    Annual = 8,
}

impl InterpretationType {
    pub fn name(&self) -> &'static str {
        match self {
            Self::Basic => "基础解读",
            Self::Detailed => "详细解读",
            Self::Professional => "专业解读",
            Self::Career => "事业解读",
            Self::Relationship => "感情解读",
            Self::Health => "健康解读",
            Self::Wealth => "财运解读",
            Self::Education => "学业解读",
            Self::Annual => "流年解读",
        }
    }
}
