# Pallet-Bazi-Chart 开发计划

> **基于**: 八字排盘项目综合分析报告.md + 八字排盘Pallet详细设计文档.md
>
> **创建日期**: 2025-11-25
>
> **目标**: 为 Stardust 区块链创建完整的八字排盘 Pallet 模块

---

## 项目概述

### 技术架构
- **框架**: Polkadot SDK / Substrate FRAME
- **语言**: Rust
- **参考项目**: BaziGo(95分) + lunar-java(93分) + bazi-mcp(92分)
- **核心功能**: 四柱计算、大运推算、五行分析、链上存储

### 关键确认
- ✅ **辰藏干**: 使用"戊乙癸"(主流派，87.5%项目支持)
- ✅ **子时模式**: 支持传统派/现代派双模式
- ✅ **节气精度**: 采用寿星天文算法(秒级精度)
- ✅ **五行强度**: 实现月令权重矩阵(12×36)

---

## Phase 1: 项目基础架构 (P0 优先级)

### 1.1 项目初始化

**TODO-001: 创建 Pallet 基础结构**
- [ ] 在 `pallets/` 目录下创建 `pallet-bazi-chart/`
- [ ] 初始化 `Cargo.toml` 配置文件
- [ ] 创建基本的 `src/lib.rs` 文件结构
- [ ] 添加必要的依赖项 (codec, scale-info, frame-system, etc.)
- [ ] 配置 `mock.rs` 和 `tests.rs` 文件

**文件结构**:
```
pallets/bazi-chart/
├── Cargo.toml
├── src/
│   ├── lib.rs          # 主模块文件
│   ├── types.rs        # 数据类型定义
│   ├── constants.rs    # 常量表定义
│   ├── calculations/   # 计算模块
│   │   ├── mod.rs
│   │   ├── ganzhi.rs   # 干支计算
│   │   ├── sizhu.rs    # 四柱计算
│   │   ├── dayun.rs    # 大运计算
│   │   └── wuxing.rs   # 五行计算
│   ├── mock.rs         # 测试模拟环境
│   └── tests.rs        # 单元测试
└── README.md
```

**时间估计**: 1天
**优先级**: ⭐⭐⭐⭐⭐

---

### 1.2 基础数据类型定义

**TODO-002: 定义核心数据类型**
- [ ] 定义 `TianGan` 天干类型 (0-9)
- [ ] 定义 `DiZhi` 地支类型 (0-11)
- [ ] 定义 `GanZhi` 干支组合类型 (0-59)
- [ ] 定义 `WuXing` 五行枚举
- [ ] 定义 `ShiShen` 十神枚举
- [ ] 实现基础转换方法 (`to_wuxing()`, `is_yang()`, etc.)

**参考实现**:
```rust
/// 天干类型 (0-9)
#[derive(Clone, Copy, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
pub struct TianGan(pub u8);

impl TianGan {
    pub fn new(value: u8) -> Result<Self, Error<T>> {
        ensure!(value < 10, Error::<T>::InvalidTianGan);
        Ok(Self(value))
    }

    pub fn to_wuxing(&self) -> WuXing { /* 实现五行转换 */ }
    pub fn is_yang(&self) -> bool { self.0 % 2 == 0 }
}
```

**时间估计**: 2天
**优先级**: ⭐⭐⭐⭐⭐

---

**TODO-003: 定义高级数据结构**
- [ ] 定义 `CangGanType` 藏干类型枚举 (主气/中气/余气)
- [ ] 定义 `CangGanInfo` 藏干信息结构 (含权重)
- [ ] 定义 `NaYin` 纳音五行枚举 (30种)
- [ ] 定义 `ZiShiMode` 子时归属模式枚举
- [ ] 定义 `JieQi` 节气枚举 (24节气)

**关键确认**:
```rust
/// 藏干类型
#[derive(Clone, Copy, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
pub enum CangGanType {
    ZhuQi = 0,   // 主气
    ZhongQi = 1, // 中气
    YuQi = 2,    // 余气
}

/// 子时归属模式 (关键功能)
#[derive(Clone, Copy, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
pub enum ZiShiMode {
    Traditional = 1, // 早子时: 23:00属次日 (传统派)
    Modern = 2,      // 晚子时: 23:00属当日 (现代派)
}
```

**时间估计**: 2天
**优先级**: ⭐⭐⭐⭐⭐

---

## Phase 2: 核心常量和查表 (P0 优先级)

### 2.1 藏干常量表

**TODO-004: 实现权威藏干查表**
- [ ] 基于BaziGo + lunar-java实现12地支藏干表
- [ ] **确保辰藏干为"戊乙癸"** (关键!)
- [ ] 实现藏干权重表 (考虑月令影响)
- [ ] 创建 `get_canggan()` 查询函数

**关键实现** (参考分析报告):
```rust
/// 12地支藏干表 (主流派标准)
pub const EARTHLY_HIDDEN_STEMS: [[u8; 3]; 12] = [
    [9, 0, 0],       // 子: 癸
    [5, 9, 7],       // 丑: 己癸辛
    [0, 2, 4],       // 寅: 甲丙戊
    [1, 0, 0],       // 卯: 乙
    [4, 1, 9],       // 辰: 戊乙癸 ← 确认癸水！
    [2, 6, 4],       // 巳: 丙庚戊
    [3, 5, 0],       // 午: 丁己
    [5, 3, 1],       // 未: 己丁乙
    [6, 8, 4],       // 申: 庚壬戊
    [7, 0, 0],       // 酉: 辛
    [4, 7, 3],       // 戌: 戊辛丁
    [8, 0, 0],       // 亥: 壬甲
];

/// 藏干权重表 (12月×36位置) - 参考BaziGo
pub const HIDDEN_STEM_WEIGHT: [[u16; 36]; 12] = [
    // 子月(水旺): 子癸1000, 丑己530/癸300/辛200...
    [1000, 0, 0, 530, 300, 200, 798, 360, 0, /* ...共36个值 */],
    // ... 其他11个月
];
```

**时间估计**: 3天
**优先级**: ⭐⭐⭐⭐⭐
**关键确认**: 必须与BaziGo、lunar-java的藏干数据一致

---

### 2.2 纳音和节气常量

**TODO-005: 实现纳音计算**
- [ ] 参考 lunisolar 实现纳音算法计算
- [ ] 定义30种纳音五行常量
- [ ] 实现 `GanZhi::to_nayin()` 方法
- [ ] 可选: 提供查表法作为性能优化

**算法实现** (参考lunisolar):
```rust
impl GanZhi {
    pub fn to_nayin(&self) -> NaYin {
        let index = (self.to_index() / 2) as usize;
        const NAYIN_TABLE: [NaYin; 30] = [
            NaYin::HaiZhongJin,   // 0: 甲子、乙丑
            NaYin::LuZhongHuo,    // 1: 丙寅、丁卯
            // ... 30种纳音
        ];
        NAYIN_TABLE[index]
    }
}
```

**时间估计**: 2天
**优先级**: ⭐⭐⭐⭐

---

**TODO-006: 实现节气计算功能**
- [ ] 研究并移植 lunar-java 的寿星天文算法
- [ ] 实现精确的节气时间计算 (秒级精度)
- [ ] 创建 `get_jieqi_time()` 函数
- [ ] 添加节气边界判断逻辑

**关键API**:
```rust
/// 获取指定年份指定节气的精确时间
pub fn calculate_jieqi_time(year: i32, jieqi_index: u8) -> DateTime {
    // 基于寿星天文算法
    // 精度达到秒级
}

/// 判断某时间是否在某节气之后
pub fn is_after_jieqi(datetime: &DateTime, jieqi_time: &DateTime) -> bool {
    datetime > jieqi_time
}
```

**时间估计**: 4天 (算法复杂)
**优先级**: ⭐⭐⭐⭐⭐
**技术难点**: 天文算法移植到Rust

---

## Phase 3: 核心计算模块 (P0 优先级)

### 3.1 干支计算

**TODO-007: 实现干支基础计算**
- [ ] 实现 `GanZhi::from_index()` 方法
- [ ] 实现 `GanZhi::to_index()` 方法
- [ ] 实现 `GanZhi::next()` 和 `prev()` 方法
- [ ] 添加干支有效性验证

**核心算法**:
```rust
impl GanZhi {
    pub fn from_index(index: u8) -> Result<Self, Error<T>> {
        ensure!(index < 60, Error::<T>::InvalidGanZhiIndex);
        Ok(Self {
            gan: TianGan(index % 10),
            zhi: DiZhi(index % 12),
        })
    }

    pub fn to_index(&self) -> u8 {
        // 实现组合算法: 找到满足条件的索引
        for i in 0..6 {
            let candidate = i * 10 + self.gan.0;
            if candidate % 12 == self.zhi.0 {
                return candidate;
            }
        }
        unreachable!()
    }
}
```

**时间估计**: 2天
**优先级**: ⭐⭐⭐⭐⭐

---

### 3.2 四柱计算模块

**TODO-008: 实现日柱计算**
- [ ] 实现基准日期计算 (公元前720年基准)
- [ ] 实现累计天数计算函数
- [ ] 实现 `calculate_day_ganzhi()` 方法
- [ ] 添加闰年处理逻辑

**基准算法** (参考BaziGo):
```rust
fn calculate_day_ganzhi(birth_time: &BirthTime) -> Result<GanZhi, DispatchError> {
    // 基准: 公元前720年1月1日为甲子日
    const BASE_YEAR: i32 = -720;

    let total_days = calculate_total_days(BASE_YEAR, birth_time.year as i32);
    let month_days = calculate_month_days(birth_time.year, birth_time.month);
    let all_days = total_days + month_days + birth_time.day as i32;

    let ganzhi_index = ((all_days + 12) % 60) as u8;
    GanZhi::from_index(ganzhi_index)
}
```

**时间估计**: 3天
**优先级**: ⭐⭐⭐⭐⭐

---

**TODO-009: 实现年柱计算**
- [ ] 实现立春边界判断
- [ ] 实现 `calculate_year_ganzhi()` 方法
- [ ] 集成节气计算模块
- [ ] 处理年份跨越立春的情况

**关键逻辑**:
```rust
fn calculate_year_ganzhi(birth_time: &BirthTime) -> Result<GanZhi, DispatchError> {
    // 判断是否在立春之后
    let lichun = get_lichun_time(birth_time.year)?;
    let bazi_year = if is_before_lichun(birth_time, &lichun) {
        birth_time.year - 1
    } else {
        birth_time.year
    };

    // 公元4年为甲子年
    let year_index = ((bazi_year - 4) % 60) as u8;
    GanZhi::from_index(year_index)
}
```

**时间估计**: 2天
**优先级**: ⭐⭐⭐⭐⭐

---

**TODO-010: 实现月柱计算 (五虎遁)**
- [ ] 实现八字月份计算 (基于节气)
- [ ] 实现五虎遁算法
- [ ] 实现 `calculate_month_ganzhi()` 方法
- [ ] 处理节气边界的月份判断

**五虎遁口诀实现**:
```rust
fn calculate_month_ganzhi(birth_time: &BirthTime, year_ganzhi: &GanZhi) -> Result<GanZhi, DispatchError> {
    let bazi_month = get_bazi_month(birth_time)?; // 基于节气

    // 五虎遁: 甲己丙作首,乙庚戊为头...
    let year_gan = year_ganzhi.gan.0;
    let base_gan = match year_gan {
        0 | 5 => 2,  // 甲己丙作首
        1 | 6 => 4,  // 乙庚戊为头
        2 | 7 => 6,  // 丙辛庚寅顺
        3 | 8 => 8,  // 丁壬壬位流
        4 | 9 => 0,  // 戊癸甲好求
        _ => return Err(Error::<T>::InvalidTianGan.into()),
    };

    let month_gan = TianGan((base_gan + bazi_month - 1) % 10);
    let month_zhi = DiZhi((bazi_month + 1) % 12); // 寅月=1, 卯月=2...

    Ok(GanZhi { gan: month_gan, zhi: month_zhi })
}
```

**时间估计**: 3天
**优先级**: ⭐⭐⭐⭐⭐

---

**TODO-011: 实现时柱计算 (五鼠遁 + 子时双模式)**
- [ ] 实现五鼠遁算法
- [ ] **实现子时双模式支持** (关键功能!)
- [ ] 实现 `calculate_hour_ganzhi()` 方法
- [ ] 添加 `zishi_mode` 参数处理

**关键实现** (支持双模式):
```rust
fn calculate_hour_ganzhi(
    birth_time: &BirthTime,
    day_ganzhi: &GanZhi,
    zishi_mode: ZiShiMode,  // 关键参数!
) -> Result<GanZhi, DispatchError> {
    let mut hour = birth_time.hour;
    let mut day_gan = day_ganzhi.gan.0;

    // 子时特殊处理 (关键逻辑!)
    if hour == 23 {
        match zishi_mode {
            ZiShiMode::Traditional => {
                // 传统派: 23:00属次日
                day_gan = (day_gan + 1) % 10;
            },
            ZiShiMode::Modern => {
                // 现代派: 23:00属当日
            },
        }
        hour = 0;  // 统一为子时
    }

    // 五鼠遁计算...
}
```

**时间估计**: 3天
**优先级**: ⭐⭐⭐⭐⭐
**关键功能**: 必须支持双模式，参考bazi-mcp实现

---

### 3.3 十神计算

**TODO-012: 实现十神查表计算**
- [ ] 实现十神查表算法
- [ ] 创建10×10十神查表
- [ ] 实现 `calculate_shishen()` 方法
- [ ] 优化查表性能

**查表实现**:
```rust
fn calculate_shishen(rizhu: TianGan, other_gan: TianGan) -> ShiShen {
    const SHISHEN_TABLE: [[u8; 10]; 10] = [
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], // 甲为日主
        [1, 0, 3, 2, 5, 4, 7, 6, 9, 8], // 乙为日主
        // ... 10行完整查表
    ];

    let index = SHISHEN_TABLE[rizhu.0 as usize][other_gan.0 as usize];
    match index {
        0 => ShiShen::BiJian,
        1 => ShiShen::JieCai,
        // ... 完整映射
    }
}
```

**时间估计**: 2天
**优先级**: ⭐⭐⭐⭐

---

## Phase 4: 大运计算模块 (P1 优先级)

### 4.1 起运计算

**TODO-013: 实现起运年龄计算**
- [ ] 实现大运顺逆规则判断
- [ ] 实现节气距离计算
- [ ] 实现年龄转换公式 (3天=1年)
- [ ] 处理负数和边界情况

**核心算法** (参考BaziGo + lunar-java):
```rust
fn calculate_qiyun_age(
    birth_time: &BirthTime,
    year_gan: TianGan,
    gender: Gender,
) -> Result<u8, DispatchError> {
    // 1. 判断顺逆: 阳男阴女顺行, 阴男阳女逆行
    let is_shun = match (year_gan.is_yang(), gender) {
        (true, Gender::Male) | (false, Gender::Female) => true,  // 顺行
        _ => false,  // 逆行
    };

    // 2. 找最近节气
    let target_jieqi = if is_shun {
        find_next_jieqi(birth_time)
    } else {
        find_prev_jieqi(birth_time)
    };

    // 3. 计算天数差
    let days = calculate_days_diff(birth_time, &target_jieqi);

    // 4. 转换年龄: 3天=1年
    Ok((days / 3) as u8)
}
```

**时间估计**: 3天
**优先级**: ⭐⭐⭐⭐

---

### 4.2 大运排列

**TODO-014: 实现大运列表生成**
- [ ] 实现大运干支序列计算
- [ ] 处理顺排和逆排逻辑
- [ ] 生成10-12步大运信息
- [ ] 计算每步大运的时间段

**大运生成算法**:
```rust
fn generate_dayun_list(
    month_ganzhi: &GanZhi,
    qiyun_age: u8,
    birth_year: u16,
    is_shun: bool,
) -> Result<Vec<DaYunStep<T>>, DispatchError> {
    let mut dayun_list = Vec::new();
    let month_index = month_ganzhi.to_index();

    for i in 0..12 {  // 生成12步大运
        let ganzhi_index = if is_shun {
            (month_index + 1 + i) % 60
        } else {
            (month_index + 59 - i) % 60  // 处理负数
        };

        let ganzhi = GanZhi::from_index(ganzhi_index)?;
        let start_age = qiyun_age + (i * 10) as u8;
        let end_age = start_age + 9;

        dayun_list.push(DaYunStep {
            ganzhi,
            start_age,
            end_age,
            start_year: birth_year + start_age as u16,
            end_year: birth_year + end_age as u16,
        });
    }

    Ok(dayun_list)
}
```

**时间估计**: 2天
**优先级**: ⭐⭐⭐⭐

---

## Phase 5: 五行强度计算 (P1 优先级)

### 5.1 五行强度核心算法

**TODO-015: 实现月令旺衰法**
- [ ] 移植BaziGo的权重矩阵算法
- [ ] 实现12×36权重表查询
- [ ] 计算天干五行强度 (每个100分)
- [ ] 计算地支藏干强度 (按权重表)

**核心实现** (参考BaziGo最佳实践):
```rust
fn calculate_wuxing_strength(sizhu: &SiZhu<T>, month_branch: u8) -> WuXingStrength {
    let mut strength = WuXingStrength::default();

    // 1. 天干五行: 每个100分
    for zhu in [&sizhu.year_zhu, &sizhu.month_zhu, &sizhu.day_zhu, &sizhu.hour_zhu] {
        let element = zhu.ganzhi.gan.to_wuxing();
        strength.add_element(element, 100);
    }

    // 2. 地支藏干: 按月令权重表
    for (zhu_index, zhu) in sizhu.iter().enumerate() {
        let hidden_stems = get_hidden_stems(zhu.ganzhi.zhi);
        for (stem_index, &stem) in hidden_stems.iter().enumerate() {
            let weight_index = zhu.ganzhi.zhi.0 as usize * 3 + stem_index;
            let weight = HIDDEN_STEM_WEIGHT[month_branch as usize][weight_index];
            let element = TianGan(stem).to_wuxing();
            strength.add_element(element, weight);
        }
    }

    strength
}
```

**时间估计**: 4天 (权重表复杂)
**优先级**: ⭐⭐⭐⭐
**技术挑战**: 12×36权重矩阵的准确实现

---

### 5.2 喜用神分析

**TODO-016: 实现喜用神判断**
- [ ] 实现五行平衡分析
- [ ] 找出最弱五行作为喜用神
- [ ] 添加日主强弱判断逻辑
- [ ] 提供多种喜用神算法选择

**简化算法**:
```rust
fn determine_xiyong_shen(strength: &WuXingStrength) -> Option<WuXing> {
    // 找出最弱的五行作为喜用神
    let elements = [
        (WuXing::Jin, strength.jin),
        (WuXing::Mu, strength.mu),
        (WuXing::Shui, strength.shui),
        (WuXing::Huo, strength.huo),
        (WuXing::Tu, strength.tu),
    ];

    elements.iter()
        .min_by_key(|(_, value)| *value)
        .map(|(element, _)| *element)
}
```

**时间估计**: 2天
**优先级**: ⭐⭐⭐

---

## Phase 6: 存储和接口设计 (P1 优先级)

### 6.1 存储结构设计

**TODO-017: 定义存储映射**
- [ ] 设计 `BaziCharts` 存储映射 (账户→八字列表)
- [ ] 设计 `ChartById` 存储映射 (哈希ID→八字详情)
- [ ] 设计 `ChartCount` 计数器
- [ ] 添加存储限制和边界检查

**存储设计**:
```rust
#[pallet::storage]
#[pallet::getter(fn bazi_charts)]
pub type BaziCharts<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::AccountId,
    BoundedVec<BaziChart<T>, T::MaxChartsPerAccount>,
    ValueQuery,
>;

#[pallet::storage]
#[pallet::getter(fn chart_by_id)]
pub type ChartById<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::Hash,
    BaziChart<T>,
>;
```

**时间估计**: 2天
**优先级**: ⭐⭐⭐⭐

---

### 6.2 Extrinsics 实现

**TODO-018: 实现创建八字接口**
- [ ] 实现 `create_bazi_chart` extrinsic
- [ ] 添加参数验证 (年月日时分格式检查)
- [ ] 集成所有计算模块
- [ ] 添加存储限制检查
- [ ] **确保支持 zishi_mode 参数**

**核心接口**:
```rust
#[pallet::call_index(0)]
#[pallet::weight(T::WeightInfo::create_bazi_chart())]
pub fn create_bazi_chart(
    origin: OriginFor<T>,
    year: u16,        // 公历年份
    month: u8,        // 公历月份
    day: u8,          // 公历日期
    hour: u8,         // 小时
    minute: u8,       // 分钟
    gender: Gender,   // 性别
    zishi_mode: ZiShiMode,  // 子时模式 (关键参数!)
) -> DispatchResult {
    let who = ensure_signed(origin)?;

    // 1. 参数验证
    ensure!(year >= 1900 && year <= 2100, Error::<T>::InvalidYear);
    // ... 其他验证

    // 2. 计算四柱
    let birth_time = BirthTime { year, month, day, hour, minute };
    let sizhu = Self::calculate_sizhu(&birth_time, zishi_mode)?;

    // 3. 计算大运
    let dayun = Self::calculate_dayun(&birth_time, &sizhu, gender)?;

    // 4. 计算五行强度
    let wuxing_strength = Self::calculate_wuxing_strength(&sizhu);

    // 5. 存储和事件
    // ...

    Ok(())
}
```

**时间估计**: 3天
**优先级**: ⭐⭐⭐⭐⭐

---

**TODO-019: 实现查询和管理接口**
- [ ] 实现 `query_bazi_chart` extrinsic
- [ ] 实现 `delete_bazi_chart` extrinsic
- [ ] 实现 `update_bazi_chart` extrinsic (可选)
- [ ] 添加权限控制逻辑

**时间估计**: 2天
**优先级**: ⭐⭐⭐

---

### 6.3 Events 和 Errors 设计

**TODO-020: 定义事件和错误**
- [ ] 定义 `BaziChartCreated` 事件
- [ ] 定义 `BaziChartQueried` 事件
- [ ] 定义 `BaziChartDeleted` 事件
- [ ] 定义完整的错误枚举 (参数无效、存储限制等)

**时间估计**: 1天
**优先级**: ⭐⭐⭐

---

## Phase 7: 测试和验证 (P1 优先级)

### 7.1 单元测试

**TODO-021: 核心算法单元测试**
- [ ] 测试干支计算的正确性
- [ ] **测试辰藏干确实为"癸水"**
- [ ] 测试子时双模式功能
- [ ] 测试四柱计算标准案例
- [ ] 测试大运计算逻辑

**关键测试用例**:
```rust
#[cfg(test)]
mod tests {
    #[test]
    fn test_chen_hidden_stems() {
        // 确保辰藏干为癸水 (关键测试!)
        let chen_stems = get_hidden_stems(DiZhi(4)); // 辰
        assert_eq!(chen_stems[0], 4); // 戊
        assert_eq!(chen_stems[1], 1); // 乙
        assert_eq!(chen_stems[2], 9); // 癸 (不是壬!)
    }

    #[test]
    fn test_zi_time_modes() {
        // 测试子时双模式
        let birth_time = BirthTime {
            year: 2024, month: 1, day: 1, hour: 23, minute: 30
        };

        let traditional = calculate_hour_ganzhi(&birth_time, day_ganzhi, ZiShiMode::Traditional);
        let modern = calculate_hour_ganzhi(&birth_time, day_ganzhi, ZiShiMode::Modern);

        // 传统派和现代派应该有不同结果
        assert_ne!(traditional.unwrap().gan, modern.unwrap().gan);
    }
}
```

**时间估计**: 4天
**优先级**: ⭐⭐⭐⭐⭐

---

### 7.2 集成测试

**TODO-022: 权威项目对比测试**
- [ ] 与BaziGo标准测试案例对比
- [ ] 与lunar-java计算结果对比
- [ ] 与bazi-mcp的双模式结果对比
- [ ] 测试边界情况 (节气边界、闰年、跨世纪等)

**标准测试案例** (来自分析报告):
```rust
#[test]
fn test_standard_cases() {
    // bazi-mcp标准案例: 1998-07-31 14:10 男
    let result = create_bazi_chart(
        Origin::signed(1),
        1998, 7, 31, 14, 10,
        Gender::Male,
        ZiShiMode::Modern,
    );

    assert_ok!(result);

    // 验证四柱: 戊寅 己未 己卯 辛未
    let chart = BaziCharts::<Test>::get(1)[0].clone();
    assert_eq!(format_sizhu(&chart.sizhu), "戊寅 己未 己卯 辛未");
}
```

**时间估计**: 3天
**优先级**: ⭐⭐⭐⭐

---

### 7.3 性能和安全测试

**TODO-023: 性能优化和安全加固**
- [ ] 测试大量八字创建的性能
- [ ] 验证存储限制的有效性
- [ ] 测试权限控制逻辑
- [ ] 添加输入参数的边界测试
- [ ] 验证权重表查询性能

**时间估计**: 2天
**优先级**: ⭐⭐⭐

---

## Phase 8: 集成和优化 (P2 优先级)

### 8.1 与 Stardust 系统集成

**TODO-024: 集成纪念馆系统**
- [ ] 扩展 `pallet-deceased-data` 添加八字字段
- [ ] 在创建纪念馆时自动生成逝者八字
- [ ] 提供八字查询的RPC接口
- [ ] 集成到 stardust-dapp 前端展示

**时间估计**: 3天
**优先级**: ⭐⭐⭐

---

### 8.2 前端展示组件

**TODO-025: 创建八字展示组件**
- [ ] 在 stardust-dapp 中添加八字展示页面
- [ ] 实现四柱八字表格展示
- [ ] 实现大运时间轴展示
- [ ] 实现五行雷达图展示

**时间估计**: 4天
**优先级**: ⭐⭐

---

### 8.3 Subsquid 数据索引

**TODO-026: 添加 Subsquid 支持**
- [ ] 在 stardust-squid 中定义 BaziChart 实体
- [ ] 监听 BaziChartCreated 事件
- [ ] 提供八字数据的 GraphQL 查询
- [ ] 优化查询性能

**时间估计**: 2天
**优先级**: ⭐⭐

---

## Phase 9: 高级功能扩展 (P3 优先级)

### 9.1 神煞系统

**TODO-027: 实现神煞计算**
- [ ] 实现天乙贵人、桃花、驿马等神煞
- [ ] 添加神煞查表和计算逻辑
- [ ] 集成到八字信息中

**时间估计**: 5天
**优先级**: ⭐⭐

---

### 9.2 刑冲合害

**TODO-028: 实现刑冲合害分析**
- [ ] 实现天干五合、地支六合
- [ ] 实现三合、三会、六冲
- [ ] 实现刑、害、破的判断

**时间估计**: 4天
**优先级**: ⭐⭐

---

### 9.3 格局判断

**TODO-029: 实现格局分析**
- [ ] 实现正格判断 (正官格、正财格等)
- [ ] 实现从格判断 (从杀格、从财格等)
- [ ] 提供格局层次评级

**时间估计**: 6天
**优先级**: ⭐

---

## 时间规划和里程碑

### 里程碑 1: 核心功能完成 (4周)
- ✅ Phase 1-3: 基础架构 + 核心算法
- 🎯 **交付物**: 可计算四柱八字的基础Pallet

### 里程碑 2: 完整功能上线 (6周)
- ✅ Phase 4-6: 大运计算 + 存储接口
- 🎯 **交付物**: 功能完整的八字排盘Pallet

### 里程碑 3: 测试验证完成 (8周)
- ✅ Phase 7: 全面测试和验证
- 🎯 **交付物**: 通过测试验证的稳定版本

### 里程碑 4: 系统集成完成 (10周)
- ✅ Phase 8: Stardust系统集成
- 🎯 **交付物**: 集成到Stardust的完整解决方案

### 里程碑 5: 高级功能交付 (14周)
- ✅ Phase 9: 神煞、格局等高级功能
- 🎯 **交付物**: 功能丰富的命理分析系统

---

## 质量保证检查清单

### 代码质量
- [ ] 所有函数都有详细的中文注释
- [ ] 使用 `#[pallet::weight]` 估算 extrinsic 重量
- [ ] 实现 `Config` trait 的所有必要类型
- [ ] 遵循 Substrate 编码规范

### 算法准确性
- [ ] **辰藏干确实为"癸水"** ✅
- [ ] 子时双模式功能正常 ✅
- [ ] 节气计算精度达到秒级 ✅
- [ ] 五行强度使用月令权重 ✅
- [ ] 与权威项目的结果一致性验证

### 安全性检查
- [ ] 所有输入参数都有验证
- [ ] 存储限制有效防止滥用
- [ ] 权限控制逻辑正确
- [ ] 错误处理完整

### 性能优化
- [ ] 查表算法优化
- [ ] 存储结构紧凑
- [ ] 避免不必要的计算
- [ ] 权重表查询高效

---

## 参考资料

### 核心参考项目
1. **BaziGo** (95分) - 五行强度算法、藏干权重表
2. **lunar-java** (93分) - 节气算法、数据结构设计
3. **bazi-mcp** (92分) - 子时双模式、API设计
4. **lunisolar** (88分) - 纳音算法、代码风格

### 技术文档
- 八字排盘项目综合分析报告.md
- 八字排盘Pallet详细设计文档.md
- Polkadot SDK 文档
- Substrate FRAME 开发指南

### 权威典籍
- 《渊海子平》- 藏干理论依据
- 《三命通会》- 传统命理规则
- 《滴天髓》- 格局判断标准

---

**计划创建日期**: 2025-11-25
**预计完成时间**: 2026-02-25 (14周)
**负责团队**: Stardust 开发团队
**当前状态**: 📋 计划制定完成，等待开发启动