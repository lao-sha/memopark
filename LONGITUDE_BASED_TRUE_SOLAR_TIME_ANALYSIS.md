# 基于经度的真太阳时设计：合理性与可行性分析

## 📋 设计方案

```rust
pub fn create_bazi_chart(
    origin: OriginFor<T>,
    name: Option<BoundedVec<u8, ConstU32<64>>>,
    gender: Gender,
    birth_input: BirthTimeInput,
    longitude: Option<i32>,  // 有值 = 启用真太阳时，None = 使用北京时间
    zishi_mode: ZiShiMode,
) -> DispatchResult
```

**核心逻辑**：
- `longitude.is_some()` → 自动启用真太阳时修正
- `longitude.is_none()` → 使用北京时间（东经120°），不修正

---

## 一、合理性分析 ⭐⭐⭐⭐⭐

### 1. 语义清晰

| 方面 | 评分 | 说明 |
|------|------|------|
| **意图明确** | ⭐⭐⭐⭐⭐ | 传经度 = 要真太阳时，不传 = 不要 |
| **无歧义** | ⭐⭐⭐⭐⭐ | 不存在"传了经度但不想用"的矛盾 |
| **符合直觉** | ⭐⭐⭐⭐⭐ | 用户思维："我要真太阳时，所以填经度" |

### 2. 避免冗余

**对比原方案**：
```rust
// ❌ 冗余设计
longitude: Option<i32>,
use_true_solar_time: bool,

// 可能出现的矛盾状态：
// 1. longitude = Some(116.4), use_true_solar_time = false  // 传了经度却不用？
// 2. longitude = None, use_true_solar_time = true          // 没经度怎么算？
```

```rust
// ✅ 简洁设计
longitude: Option<i32>,  // 有值即用，无值即不用

// 逻辑自洽，无矛盾状态
```

### 3. 减少用户困惑

**用户视角**：

```
┌─────────────────────────────────────┐
│ ☑ 使用真太阳时修正                 │
│   出生地经度: [116.40]°E           │
│                                     │
│ ☐ 使用真太阳时修正                 │
│   (不显示经度输入框)                │
└─────────────────────────────────────┘
```

**前端逻辑**：
```typescript
if (useTrueSolarTime) {
  longitude = parseFloat(longitudeInput);
} else {
  longitude = null;  // 不传
}
```

**对比冗余设计**：
```typescript
// ❌ 用户可能困惑
longitude = parseFloat(longitudeInput);
useTrueSolarTime = checkbox.checked;
// "我填了经度，还要勾选吗？"
```

---

## 二、可行性分析 ⭐⭐⭐⭐⭐

### 1. 技术实现

#### 链上逻辑
```rust
pub fn create_bazi_chart(
    origin: OriginFor<T>,
    name: Option<BoundedVec<u8, ConstU32<64>>>,
    gender: Gender,
    birth_input: BirthTimeInput,
    longitude: Option<i32>,  // 经度 × 10000
    zishi_mode: ZiShiMode,
) -> DispatchResult {
    let who = ensure_signed(origin)?;
    
    // 验证经度有效性（如果提供）
    if let Some(lon) = longitude {
        ensure!(
            lon >= -1800000 && lon <= 1800000,
            Error::<T>::InvalidLongitude
        );
    }
    
    // 解析出生时间
    let (year, month, day, hour, minute) = match birth_input {
        BirthTimeInput::Solar { year, month, day, hour, minute } => {
            (year, month, day, hour, minute)
        },
        BirthTimeInput::Lunar { year, month, day, is_leap, hour, minute } => {
            let (sy, sm, sd) = pallet_almanac::lunar::lunar_to_solar(
                year, month, day, is_leap
            ).ok_or(Error::<T>::InvalidLunarDate)?;
            (sy, sm, sd, hour, minute)
        },
        BirthTimeInput::DirectPillars { .. } => {
            // 直接四柱，跳过时间处理
            return Self::create_from_pillars(who, name, gender, birth_input, longitude);
        },
    };
    
    // 真太阳时修正（如果提供经度）
    let (final_hour, final_minute) = if let Some(lon) = longitude {
        let correction_minutes = Self::calculate_true_solar_correction(
            lon, year, month, day
        );
        Self::apply_time_correction(hour, minute, correction_minutes)
    } else {
        (hour, minute)  // 不修正，使用原始时间
    };
    
    // 继续四柱计算...
    // ...
}
```

#### 真太阳时计算
