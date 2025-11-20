# 动态调整押金机制 - 核心设计

**方案**: 方案3 - 动态调整押金（最灵活）  
**设计日期**: 2025-11-18  
**状态**: 最终方案

---

## 一、核心理念

### 价值区间设计

```
安全区间：8 USDT - 12 USDT (±20%)
目标值：10 USDT

├─────────┼─────────┼─────────┼─────────┤
0        8        10       12        ∞
         ↑        ↑        ↑
      警戒线    目标值   解锁线
```

**调整规则**：
- **< 8 USDT**: 触发补充警告，7天内必须补充
- **8-12 USDT**: 安全区间，无需调整
- **> 12 USDT**: 允许部分解锁（用户获益）

---

## 二、扩展数据结构

```rust
pub struct OwnerDepositRecord<T: Config> {
    // 基础信息
    pub owner: T::AccountId,
    pub deceased_id: u64,
    pub target_deposit_usdt: u32,  // 10 USDT
    
    // 初始锁定
    pub initial_deposit_dust: BalanceOf<T>,
    pub initial_exchange_rate: u64,
    pub locked_at: BlockNumberFor<T>,
    
    // 当前状态
    pub current_locked_dust: BalanceOf<T>,  // 动态变化
    pub available_usdt: u32,
    pub deducted_usdt: u32,
    
    // 调整历史（最多50条）
    pub adjustments: BoundedVec<DepositAdjustment<T>, ConstU32<50>>,
    
    // 补充警告
    pub supplement_warning: Option<SupplementWarning<T>>,
    
    pub status: DepositStatus,
}

pub struct DepositAdjustment<T: Config> {
    pub adjustment_type: AdjustmentType,  // Supplement/Unlock/ForcedSupplement
    pub dust_amount: BalanceOf<T>,
    pub exchange_rate: u64,
    pub usdt_equivalent: u32,
    pub adjusted_at: BlockNumberFor<T>,
    pub reason: BoundedVec<u8, ConstU32<128>>,
}

pub struct SupplementWarning<T: Config> {
    pub warned_at: BlockNumberFor<T>,
    pub required_usdt: u32,
    pub required_dust: BalanceOf<T>,
    pub deadline: BlockNumberFor<T>,  // 7天后
    pub warning_rate: u64,
}
```

---

## 三、核心Extrinsics

### 3.1 补充押金

```rust
pub fn supplement_deposit(
    origin: OriginFor<T>,
    deceased_id: T::DeceasedId,
    dust_amount: BalanceOf<T>,
) -> DispatchResult
```

**功能**: 用户主动补充DUST押金  
**使用场景**: 收到警告后，或主动增加安全边界  
**限制**: 需要账户有足够DUST余额

---

### 3.2 解锁押金

```rust
pub fn unlock_excess_deposit(
    origin: OriginFor<T>,
    deceased_id: T::DeceasedId,
    dust_amount: BalanceOf<T>,
) -> DispatchResult
```

**功能**: 用户取回多余押金（DUST涨价时）  
**条件**: 
- 当前价值 > 12 USDT
- 解锁后价值 ≥ 10 USDT  
**收益**: 用户从DUST涨价中获益

---

### 3.3 强制补充（治理）

```rust
pub fn force_supplement_deposit(
    origin: OriginFor<T>,  // Root或治理委员会
    deceased_id: T::DeceasedId,
    dust_amount: BalanceOf<T>,
) -> DispatchResult
```

**功能**: 用户逾期未补充时，治理强制执行  
**触发条件**: 
- 已发出警告
- 超过7天期限  
**行为**: 
- 尝试从用户余额强制hold DUST
- 如余额不足，标记押金为Depleted

---

## 四、自动检查机制

### 4.1 定期检查（Hooks）

```rust
#[pallet::hooks]
impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
    fn on_idle(_n: BlockNumberFor<T>, remaining_weight: Weight) -> Weight {
        // 每100块检查一次（约10分钟）
        if _n % 100 != 0 { return Weight::zero(); }
        
        // 批量检查押金状态（每次最多10个）
        for (deceased_id, _) in OwnerDepositRecords::<T>::iter().take(10) {
            let _ = Self::check_and_trigger_adjustment(deceased_id);
        }
        
        Weight::from_parts(10_000, 0)
    }
}
```

**频率**: 每100块（约10分钟）  
**批次**: 每次检查10个押金记录  
**Gas成本**: 链上空闲时执行，不影响用户交易

---

### 4.2 检查逻辑

```rust
pub fn check_and_trigger_adjustment(deceased_id: u64) -> Result<DepositCheckResult, Error> {
    // 1. 获取当前汇率
    let current_rate = ExchangeRateHelper::get_cached_rate()?;
    
    // 2. 计算当前DUST的USDT价值
    let current_value = calculate_dust_value_in_usdt(record.current_locked_dust, current_rate)?;
    
    // 3. 判断区间
    let target = 10;
    if current_value < 8 {
        // 低于阈值，发出警告（如果未发出）
        if record.supplement_warning.is_none() {
            issue_supplement_warning(&mut record, current_rate, current_value)?;
        }
        return Ok(DepositCheckResult::BelowThreshold { current_value, shortfall: 10 - current_value });
        
    } else if current_value > 12 {
        // 高于阈值，用户可解锁
        return Ok(DepositCheckResult::AboveThreshold { current_value, unlockable: current_value - 10 });
        
    } else {
        // 安全区间，清除警告
        record.supplement_warning = None;
        return Ok(DepositCheckResult::InSafeRange { current_value });
    }
}
```

---

## 五、用户体验流程

### 场景1：DUST跌价30%

```
Day 1: 创建逝者
└─ 锁定: 20 DUST @ 0.5 USDT = 10 USDT ✅

Day 30: DUST跌至0.35 USDT
├─ 当前价值: 20 DUST @ 0.35 = 7 USDT ⚠️
├─ 系统检测: 低于8 USDT阈值
├─ 发出警告: 需补充3 USDT (≈ 8.57 DUST)
└─ 截止日期: Day 37

Day 31-37: 用户响应
├─ 选项1: 调用 supplement_deposit(9 DUST) ✅
│   └─ 总计: 29 DUST @ 0.35 ≈ 10 USDT
├─ 选项2: 等待DUST回升
└─ 选项3: 忽略警告 ❌

Day 38: 逾期处理
├─ 治理调用 force_supplement_deposit
├─ 从用户余额强制扣除9 DUST
└─ 如余额不足 → 标记 Depleted
```

---

### 场景2：DUST涨价100%

```
Day 1: 创建逝者
└─ 锁定: 20 DUST @ 0.5 USDT = 10 USDT

Day 30: DUST涨至1.0 USDT
├─ 当前价值: 20 DUST @ 1.0 = 20 USDT 🎉
├─ 系统检测: 高于12 USDT阈值
└─ 用户可解锁: 最多8 USDT (8 DUST)

用户操作:
├─ 调用 unlock_excess_deposit(8 DUST)
├─ 获得: 8 DUST (价值8 USDT)
└─ 剩余: 12 DUST @ 1.0 = 12 USDT (安全区间上限)
```

---

### 场景3：DUST价格稳定

```
Day 1-365: DUST价格波动±10%
├─ 价值始终在 9-11 USDT 范围
├─ 系统检测: 安全区间
└─ 无需任何操作 ✅
```

---

## 六、关键优势

### 6.1 价值稳定保证

✅ **系统视角**: 押金价值始终维持在8-12 USDT  
✅ **用户视角**: 罚款金额明确（10 USDT以内），可预期

### 6.2 公平的风险分担

- **DUST跌价**: 用户补充押金（承担下行风险）
- **DUST涨价**: 用户可解锁（享受上行收益）
- **20%缓冲区**: 避免频繁调整

### 6.3 灵活性

✅ 用户可主动补充（提高安全边界）  
✅ 用户可主动解锁（获取涨价收益）  
✅ 系统自动检查（无需用户操作）  
✅ 治理兜底（防止恶意忽略）

---

## 七、Gas成本分析

### 7.1 自动检查成本

```
频率: 每100块（约10分钟）
批次: 10个押金记录/次
单次成本: ~100,000 gas (链上空闲时执行)
日成本: 约1,440,000 gas (144次/天)
```

**优化**: 使用 `on_idle` hook，仅在区块有剩余容量时执行

---

### 7.2 用户操作成本

| 操作 | Gas成本 | 频率 |
|-----|---------|------|
| supplement_deposit | ~150,000 | 低（仅DUST跌价时） |
| unlock_excess_deposit | ~150,000 | 低（仅DUST涨价时） |
| check_deposit_value | ~50,000 | 按需（用户主动） |

---

## 八、风险与缓解

### 8.1 Gas成本风险

**风险**: 定期检查消耗链上资源  
**缓解**: 
- 使用 `on_idle` hook（空闲时执行）
- 批量处理（每次最多10个）
- 可通过治理调整检查频率

---

### 8.2 用户体验风险

**风险**: 用户可能不理解动态调整机制  
**缓解**: 
- 前端清晰展示当前状态和操作建议
- 发出警告时同步通知用户（邮件/推送）
- 提供模拟计算工具

---

### 8.3 汇率操纵风险

**风险**: 恶意用户可能尝试操纵汇率以解锁押金  
**缓解**: 
- 汇率来自pallet-pricing（去中心化预言机）
- 1小时缓存（平滑短期波动）
- 20%缓冲区（抵抗小幅操纵）

---

## 九、实施计划

### Phase 1: 核心功能（2周）
- [ ] 扩展 OwnerDepositRecord 结构
- [ ] 实现 supplement_deposit
- [ ] 实现 unlock_excess_deposit
- [ ] 实现检查逻辑
- [ ] 单元测试

### Phase 2: 自动化（1周）
- [ ] 实现 on_idle hook
- [ ] 实现 force_supplement_deposit
- [ ] 集成测试

### Phase 3: 前端集成（1周）
- [ ] 押金状态展示
- [ ] 补充/解锁界面
- [ ] 警告通知系统
- [ ] 模拟计算工具

### Phase 4: 上线准备（1周）
- [ ] 安全审计
- [ ] 文档完善
- [ ] 用户教育材料
- [ ] 监控面板

**总计**: 5周

---

## 十、总结

### 核心特性

✅ **价值稳定**: 8-12 USDT安全区间  
✅ **用户友好**: DUST涨价时可获益  
✅ **系统安全**: 自动检查+治理兜底  
✅ **公平合理**: 风险与收益共担

### 适用场景

⭐⭐⭐⭐⭐ 长期运营的区块链系统  
⭐⭐⭐⭐⭐ DUST价格波动较大的市场  
⭐⭐⭐⭐⭐ 用户数量>1000的规模

### 与其他方案对比

| 方案 | 实施难度 | 用户体验 | 系统风险 | 长期价值 |
|-----|---------|---------|---------|---------|
| 方案1: 纯USDT | 低 | ⭐⭐⭐⭐⭐ | 低 | ⭐⭐⭐⭐ |
| 方案2: 固定汇率 | 低 | ⭐⭐⭐⭐ | 中 | ⭐⭐⭐ |
| **方案3: 动态调整** | **高** | **⭐⭐⭐⭐⭐** | **低** | **⭐⭐⭐⭐⭐** |

**推荐指数**: ⭐⭐⭐⭐⭐（长期最优解）
