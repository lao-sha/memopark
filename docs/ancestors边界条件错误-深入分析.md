# ancestors 边界条件错误 - 深入分析

## 一、问题发现

**严重等级**：🟡 中  
**影响范围**：计酬模块多算 1 层佣金  
**优先级**：P1

---

## 二、问题定位

### 当前实现（有缺陷）

```rust:238:253:pallets/stardust-referrals/src/lib.rs
/// 函数级中文注释：向上遍历祖先链，最多 `max_hops` 层，返回路径（不含 self）。
pub fn ancestors(who: &T::AccountId, max_hops: u32) -> Vec<T::AccountId> {
    let mut out = Vec::new();
    let mut cursor = SponsorOf::<T>::get(who);
    let mut hops: u32 = 0;
    while let Some(cur) = cursor {
        out.push(cur.clone());      // ❌ 先添加数据
        if hops >= max_hops {        // ❌ 后检查边界
            break;
        }
        cursor = SponsorOf::<T>::get(&cur);
        hops = hops.saturating_add(1);
    }
    out
}
```

### 问题根源

**边界检查顺序错误**：先 `push` 数据，后检查 `hops >= max_hops`，导致多返回 1 个元素。

---

## 三、问题演示

### 测试场景

假设推荐关系链：
```
User -> A -> B -> C -> D -> E -> F -> G
```

调用 `ancestors(User, max_hops=3)`，**期望返回** `[A, B, C]`（3 个上级）

### 实际执行流程

| 循环次数 | hops 值 | 操作 | 检查 hops >= 3 | out 内容 | 说明 |
|---------|---------|------|---------------|----------|------|
| 第1次 | 0 | push(A) | 0 >= 3 = **false** | [A] | ✅ 正确 |
| 第2次 | 1 | push(B) | 1 >= 3 = **false** | [A, B] | ✅ 正确 |
| 第3次 | 2 | push(C) | 2 >= 3 = **false** | [A, B, C] | ✅ 正确 |
| 第4次 | 3 | push(D) | 3 >= 3 = **true** → break | [A, B, C, **D**] | ❌ **多算1层** |

### 实际返回

```rust
[A, B, C, D]  // ❌ 返回 4 个元素，而不是期望的 3 个
```

---

## 四、影响分析

### 4.1 计酬模块影响

假设计酬规则：**3 层推荐奖励**（10%, 5%, 3%）

**正确流程**：
```
用户购买 100 DUST
- A 获得 10 DUST (10%)
- B 获得 5 DUST (5%)
- C 获得 3 DUST (3%)
总计：18 DUST
```

**当前错误流程**：
```
用户购买 100 DUST
调用 ancestors(user, 3) 返回 [A, B, C, D]  ← 多了 D
- A 获得 10 DUST (10%)
- B 获得 5 DUST (5%)
- C 获得 3 DUST (3%)
- D 获得 ??? (应该没有，但被计入)  ← 多算佣金
```

**资金损失**：
- 如果计酬模块使用固定比例数组 `[10%, 5%, 3%]`，D 可能拿到 0%（越界访问）
- 如果计酬模块有兜底逻辑，D 可能拿到额外奖励（资金泄漏）

### 4.2 其他模块影响

| 模块 | 使用场景 | 影响 |
|-----|---------|------|
| **pallet-memo-affiliate** | 计算推荐佣金 | ❌ 多发 1 层佣金 |
| **前端查询** | 显示推荐链 | ⚠️ 显示层级错误 |
| **统计分析** | 推荐深度统计 | ⚠️ 数据偏差 |

---

## 五、修复方案

### 方案A：先检查，后添加（推荐）

```rust
/// 函数级中文注释：向上遍历祖先链，最多 `max_hops` 层，返回路径（不含 self）。
/// - 修复边界条件：确保返回元素数量 <= max_hops
pub fn ancestors(who: &T::AccountId, max_hops: u32) -> Vec<T::AccountId> {
    let mut out = Vec::new();
    let mut cursor = SponsorOf::<T>::get(who);
    let mut hops: u32 = 0;
    
    while let Some(cur) = cursor {
        // ✅ 先检查边界
        if hops >= max_hops {
            break;
        }
        
        // ✅ 后添加数据
        out.push(cur.clone());
        cursor = SponsorOf::<T>::get(&cur);
        hops = hops.saturating_add(1);
    }
    
    out
}
```

**优点**：
- ✅ 逻辑清晰：边界检查在数据添加之前
- ✅ 符合直觉：`hops` 表示当前正在处理的层级索引（0-based）
- ✅ 易于维护

**执行流程验证**：

| 循环次数 | hops 值 | 检查 hops >= 3 | 操作 | out 内容 |
|---------|---------|---------------|------|----------|
| 第1次 | 0 | 0 >= 3 = **false** | push(A) | [A] |
| 第2次 | 1 | 1 >= 3 = **false** | push(B) | [A, B] |
| 第3次 | 2 | 2 >= 3 = **false** | push(C) | [A, B, C] |
| 第4次 | 3 | 3 >= 3 = **true** → break | - | [A, B, C] ✅ |

---

### 方案B：调整边界值（不推荐）

```rust
pub fn ancestors(who: &T::AccountId, max_hops: u32) -> Vec<T::AccountId> {
    let mut out = Vec::new();
    let mut cursor = SponsorOf::<T>::get(who);
    let mut hops: u32 = 0;
    
    while let Some(cur) = cursor {
        out.push(cur.clone());
        // ⚠️ 改为检查 hops + 1
        if hops + 1 >= max_hops {
            break;
        }
        cursor = SponsorOf::<T>::get(&cur);
        hops = hops.saturating_add(1);
    }
    
    out
}
```

**缺点**：
- ❌ 逻辑不清晰：`hops + 1` 容易引起混淆
- ❌ 违反直觉：检查发生在数据已添加之后

---

### 方案C：使用 `Vec::len()` 检查（备选）

```rust
pub fn ancestors(who: &T::AccountId, max_hops: u32) -> Vec<T::AccountId> {
    let mut out = Vec::new();
    let mut cursor = SponsorOf::<T>::get(who);
    
    while let Some(cur) = cursor {
        // ✅ 直接检查结果集大小
        if out.len() >= max_hops as usize {
            break;
        }
        
        out.push(cur.clone());
        cursor = SponsorOf::<T>::get(&cur);
    }
    
    out
}
```

**优点**：
- ✅ 无需维护 `hops` 变量
- ✅ 逻辑简洁

**缺点**：
- ⚠️ 每次循环调用 `len()`（虽然开销极小）

---

## 六、推荐方案：方案A

**理由**：
1. ✅ 逻辑最清晰（先检查边界，后添加数据）
2. ✅ 符合编程习惯（边界检查前置）
3. ✅ 易于审计和维护
4. ✅ 性能无差异（与其他方案相同）

---

## 七、测试用例

### 7.1 单元测试（建议补充）

```rust
#[test]
fn test_ancestors_boundary_exact() {
    new_test_ext().execute_with(|| {
        // 设置推荐链：1 -> 2 -> 3 -> 4 -> 5
        assert_ok!(MemoReferrals::bind_sponsor(Origin::signed(2), 1));
        assert_ok!(MemoReferrals::bind_sponsor(Origin::signed(3), 2));
        assert_ok!(MemoReferrals::bind_sponsor(Origin::signed(4), 3));
        assert_ok!(MemoReferrals::bind_sponsor(Origin::signed(5), 4));
        
        // 测试：max_hops = 3，应返回恰好 3 个元素
        let result = MemoReferrals::ancestors(&5, 3);
        assert_eq!(result.len(), 3, "应返回恰好 3 层上级");
        assert_eq!(result, vec![4, 3, 2], "应返回 [4, 3, 2]");
    });
}

#[test]
fn test_ancestors_boundary_less() {
    new_test_ext().execute_with(|| {
        // 设置推荐链：1 -> 2 (只有 1 层)
        assert_ok!(MemoReferrals::bind_sponsor(Origin::signed(2), 1));
        
        // 测试：max_hops = 3，但实际只有 1 层
        let result = MemoReferrals::ancestors(&2, 3);
        assert_eq!(result.len(), 1, "实际只有 1 层");
        assert_eq!(result, vec![1]);
    });
}

#[test]
fn test_ancestors_boundary_zero() {
    new_test_ext().execute_with(|| {
        // 设置推荐链：1 -> 2 -> 3
        assert_ok!(MemoReferrals::bind_sponsor(Origin::signed(2), 1));
        assert_ok!(MemoReferrals::bind_sponsor(Origin::signed(3), 2));
        
        // 测试：max_hops = 0，应返回空数组
        let result = MemoReferrals::ancestors(&3, 0);
        assert_eq!(result.len(), 0, "max_hops=0 应返回空数组");
    });
}

#[test]
fn test_ancestors_boundary_one() {
    new_test_ext().execute_with(|| {
        // 设置推荐链：1 -> 2 -> 3 -> 4
        assert_ok!(MemoReferrals::bind_sponsor(Origin::signed(2), 1));
        assert_ok!(MemoReferrals::bind_sponsor(Origin::signed(3), 2));
        assert_ok!(MemoReferrals::bind_sponsor(Origin::signed(4), 3));
        
        // 测试：max_hops = 1，应返回恰好 1 个元素
        let result = MemoReferrals::ancestors(&4, 1);
        assert_eq!(result.len(), 1, "max_hops=1 应返回恰好 1 个元素");
        assert_eq!(result, vec![3]);
    });
}
```

---

## 八、关联代码检查

### 8.1 bind_sponsor 中的环检测逻辑

```rust:136:156:pallets/stardust-referrals/src/lib.rs
// 环检测：向上遍历 sponsor 链，最多 MaxHops 步，若命中 who 则拒绝。
let mut cursor = Some(sponsor.clone());
let mut hops: u32 = 0;
while let Some(cur) = cursor {
    ensure!(cur != who, Error::<T>::CycleDetected);
    if hops >= T::MaxHops::get() {  // ❌ 同样的边界问题
        break;
    }
    cursor = SponsorOf::<T>::get(&cur);
    hops = hops.saturating_add(1);
}
```

**问题**：这里的边界检查也是**后检查**，但影响相对较小：
- ✅ **不影响功能正确性**：防环检测依然有效
- ⚠️ **性能微弱影响**：可能多检测 1 层（多 1 次存储读取）

**建议**：为了代码一致性，也应该修复为**先检查，后遍历**。

---

## 九、修复优先级评估

| 评估项 | 等级 | 说明 |
|-------|------|------|
| **严重性** | 🟡 中 | 导致计酬错误，但不涉及资金安全漏洞 |
| **影响范围** | 🔴 高 | 所有使用 `ancestors` 的计酬模块 |
| **修复难度** | 🟢 低 | 只需调整 3 行代码 |
| **测试成本** | 🟢 低 | 单元测试即可覆盖 |
| **破坏性** | 🟢 低 | 无 API 变更，内部逻辑修复 |

**综合评估**：**P1 优先级**，建议立即修复。

---

## 十、迁移与兼容性

### 10.1 是否需要数据迁移？

**答案**：❌ 不需要

- `ancestors` 是纯读函数，不涉及存储
- 修复后历史数据仍然有效
- 只影响未来的查询结果

### 10.2 是否影响现有计酬？

**答案**：⚠️ 可能需要重新计算

- 如果历史计酬已发放，**不建议回滚**（避免用户困惑）
- 可以在修复后发布公告："修复计酬层级错误，今后按正确层级计算"
- 建议统计历史多发佣金总额，作为系统成本记录

---

## 十一、总结

### 核心问题
`ancestors` 函数的边界检查发生在数据添加**之后**，导致返回元素数量 = `max_hops + 1`。

### 影响
- 计酬模块多发 1 层佣金
- 推荐链查询显示错误层级
- 统计数据偏差

### 修复方案
**方案A（推荐）**：将边界检查移到数据添加**之前**。

### 实施计划
1. ✅ 深入分析（已完成）
2. ⏳ 修复 `ancestors` 函数
3. ⏳ 修复 `bind_sponsor` 环检测（一致性优化）
4. ⏳ 补充单元测试
5. ⏳ 编译验证
6. ⏳ 生成实施完成报告

---

**分析日期**：2025-10-23  
**分析人员**：AI Assistant  
**优先级**：P1（建议立即修复）  
**风险等级**：🟡 中（影响计酬准确性，但不涉及资金安全）

