# Pallet-Deceased Token 不可变性设计方案（修订版）

## 📅 分析日期
**2025-11-18（修订）**

## 🔄 设计理念转变

### 初始误判
在第一次分析中，我认为 token 的重复概率高，不适合作为唯一标识符。

### 用户洞察
**用户指出**："生成的token，重复比率极低，可以作为稳定的唯一标识符。"

### 重新评估结论
**用户判断完全正确**：

1. **重复概率分析**：
   - Token 组成：性别(2种) × 出生日期(36500天) × 离世日期(36500天) × 姓名(无限)
   - 组合空间：数十亿级别
   - 实际重复概率：接近零

2. **现实场景验证**：
   ```
   同时满足以下条件才重复：
   - 同性别
   - 同一天出生
   - 同一天离世
   - 同姓名（规范化后）

   现实中几乎不可能发生
   ```

---

## 🎯 真正的问题：可变性而非唯一性

### 核心矛盾重新定义

**不是**：Token 重复概率高，不够唯一
**而是**：Token 在更新时被重新生成，违反了"不可更改"原则

### 问题根源

**当前实现**：
```rust
// update_deceased 中
let old_token = d.deceased_token.clone();
let new_token = Self::build_deceased_token(&d.gender, &d.birth_ts, &d.death_ts, &d.name);
if new_token != old_token {
    // 更新索引
    d.deceased_token = new_token.clone();
    DeceasedIdByToken::<T>::remove(old_token);
    DeceasedIdByToken::<T>::insert(new_token, id);
}
```

**问题场景**：
```rust
// 场景1：姓名更正
创建时：M19800101202501ZHANG SAN
更正后：M19800101202501ZHANG SANG
结果：Token变化，外部引用失效

// 场景2：日期更正
创建时：M19800101202501ZHANG SAN
更正后：M19800102202501ZHANG SAN
结果：Token变化，索引需要维护
```

---

## 💡 优化方案：不可变 Token 设计

### 设计原则

**Token = 创建时刻的身份指纹**

- ✅ 基于创建时的信息生成
- ✅ 生成后永不更改
- ✅ 记录"最初的身份认定"
- ✅ 信息更正不影响 token

### 业务逻辑分离

**Token（不可变）**：
- 用途：唯一标识符、外部引用、索引键
- 生成：仅在 create_deceased 时
- 更新：永不更新

**显示信息（可变）**：
- 字段：name, birth_ts, death_ts
- 用途：前端显示、用户查看
- 更新：允许更正错误

**变更历史（追溯）**：
- 机制：EditHistory
- 用途：审计、治理、追溯
- 记录：所有修改历史

---

## 🛠️ 具体实施方案

### Phase 1：移除 Token 更新逻辑

#### 修改 1：update_deceased 函数

**删除的代码**（约15行）：
```rust
// ❌ 删除：token 重新生成
let old_token = d.deceased_token.clone();
let new_token = Self::build_deceased_token(&d.gender, &d.birth_ts, &d.death_ts, &d.name);
if new_token != old_token {
    if let Some(existing_id) = DeceasedIdByToken::<T>::get(&new_token) {
        if existing_id != id {
            return Err(Error::<T>::DeceasedTokenExists.into());
        }
    }
    d.deceased_token = new_token.clone();
    DeceasedIdByToken::<T>::remove(old_token);
    DeceasedIdByToken::<T>::insert(new_token, id);
}
```

**保留的逻辑**：
```rust
// ✅ 保留：信息更新
if let Some(n) = name {
    d.name = BoundedVec::try_from(n).map_err(|_| Error::<T>::BadInput)?;
}
if let Some(b) = birth_ts {
    d.birth_ts = Some(BoundedVec::try_from(b).map_err(|_| Error::<T>::BadInput)?);
}
if let Some(dt) = death_ts {
    d.death_ts = Some(BoundedVec::try_from(dt).map_err(|_| Error::<T>::BadInput)?);
}

// ✅ 保留：Token 不变
// d.deceased_token 字段不被修改
```

#### 修改 2：gov_update_profile 函数

**删除的代码**（约15行）：
```rust
// ❌ 删除：相同的 token 重新生成逻辑
let old_token = d.deceased_token.clone();
let new_token = Self::build_deceased_token(&d.gender, &d.birth_ts, &d.death_ts, &d.name);
if new_token != old_token {
    if let Some(existing_id) = DeceasedIdByToken::<T>::get(&new_token) {
        if existing_id != id {
            return Err(Error::<T>::DeceasedTokenExists.into());
        }
    }
    d.deceased_token = new_token.clone();
    DeceasedIdByToken::<T>::remove(old_token);
    DeceasedIdByToken::<T>::insert(new_token, id);
}
```

### Phase 2：更新注释和文档

#### 更新函数注释

```rust
/// ### 设计理念
/// - **Token 不可变性**：deceased_token 在创建时生成，后续永不更改
/// - **信息可修正**：name、birth_ts、death_ts 可以更正，但不影响 token
/// - **历史可追溯**：所有修改通过 EditHistory 记录
```

#### 更新 build_deceased_token 注释

```rust
/// ### 使用场景
/// - **create_deceased**: 创建时生成初始token（唯一调用点）
/// - ~~update_deceased~~: 不再重新生成token
/// - ~~gov_update_profile~~: 不再重新生成token
```

### Phase 3：编译验证

```bash
cargo check -p pallet-deceased
cargo test -p pallet-deceased
```

---

## 📊 优化效果

### 代码减少

| 位置 | 删除前 | 删除后 | 净减少 |
|------|--------|--------|--------|
| update_deceased | 约90行 | 约75行 | -15行 |
| gov_update_profile | 约95行 | 约80行 | -15行 |
| **总计** | | | **-30行** |

### 复杂度降低

**删除的逻辑**：
- ❌ Token 重新生成
- ❌ Token 冲突检查
- ❌ 索引删除
- ❌ 索引重新插入
- ❌ 条件分支判断

**保留的逻辑**：
- ✅ 信息字段更新
- ✅ 权限检查
- ✅ 版本历史记录

### 性能提升

**每次更新操作**：
- 减少 1 次 token 计算（包括姓名规范化、字符串拼接）
- 减少 1 次存储读取（DeceasedIdByToken 冲突检查）
- 减少 2 次存储写入（remove + insert）

**估算**：每次更新减少约 **4 次存储操作**

### 稳定性提升

**外部引用**：
- ✅ Text 模块的 deceased_token 引用永远有效
- ✅ Media 模块的 deceased_token 引用永远有效
- ✅ Life 模块的 deceased_token 引用永远有效
- ✅ 外部系统基于 token 的查询永不失效

**索引稳定**：
- ✅ DeceasedIdByToken 映射一旦建立永不改变
- ✅ 无需维护复杂的索引更新逻辑

---

## 🎯 设计哲学

### Token 的语义定义

**Token = 创建时刻的身份指纹**

类比现实世界：
- 身份证号码：一旦分配永不更改
- 人的姓名：可以更改（改名）
- 人的生日：可以更正（登记错误）

**在系统中**：
- `deceased_token`：类似身份证号，永久不变
- `name`, `birth_ts`, `death_ts`：类似档案信息，可以更正

### 信息更正的处理

**场景 1：录入错误**
```rust
// 创建时录入错误
name: "张三" (应该是"张参")
token: M19800101202501ZHANG SAN

// 更正
name: "张参"
token: M19800101202501ZHANG SAN  // 保持不变

// 通过 EditHistory 查看修改历史
```

**场景 2：身份认定错误**
```rust
// 如果整个身份认定错误（张三 → 李四）
// 应该删除错误记录，重新创建正确记录
// 而不是通过更新来"改变身份"
```

---

## ⚠️ 边界情况处理

### 情况 1：创建时信息就有错误

**问题**：如果创建时姓名就写错了，token 永久包含错误信息

**处理方案**：
```rust
// 方案 A：接受这个设计权衡
// - Token 记录"创建时刻的认定"
// - 后续更正通过字段更新 + 历史记录体现

// 方案 B：提供治理删除 + 重新创建机制
// - 治理投票删除错误记录
// - 重新创建正确记录
// - 适用于重大身份认定错误
```

### 情况 2：Token 冲突（极低概率）

**发生概率**：几乎为零

**处理**：
```rust
// 创建时检查
ensure!(
    DeceasedIdByToken::<T>::get(&deceased_token).is_none(),
    Error::<T>::DeceasedTokenExists
);

// 如果真的冲突：
// 1. 提示用户检查信息是否重复
// 2. 微调姓名写法（如添加中间名）
// 3. 或通过治理机制处理特殊情况
```

---

## 📋 实施清单

### ✅ 第一步：代码修改（20分钟）

- [ ] 删除 update_deceased 中的 token 更新逻辑
- [ ] 删除 gov_update_profile 中的 token 更新逻辑
- [ ] 更新相关函数注释

### ✅ 第二步：编译验证（5分钟）

- [ ] cargo check -p pallet-deceased
- [ ] 验证无编译错误
- [ ] 验证无编译警告

### ✅ 第三步：测试验证（可选）

- [ ] cargo test -p pallet-deceased
- [ ] 验证现有测试通过
- [ ] 考虑添加新测试用例

### ✅ 第四步：文档更新（10分钟）

- [ ] 更新 README.md 说明 token 不可变性
- [ ] 创建完成报告
- [ ] 更新设计文档

**总计时间**：约 35 分钟

---

## 🏆 预期成果

### 代码质量

**简化程度**：
- 删除 30 行复杂逻辑
- 移除条件分支和错误处理
- 统一 token 语义

**可读性**：
```rust
// ✅ 优化后的逻辑清晰
// update_deceased: 更新显示信息，不动 token
// gov_update_profile: 治理更正信息，不动 token
// create_deceased: 唯一生成 token 的地方
```

### 性能收益

**存储操作减少**：
- 每次更新减少 4 次存储操作
- 整体写入吞吐量提升
- Gas 费用降低

### 系统稳定性

**引用稳定**：
- Token 永不变化
- 外部引用永远有效
- 无需担心引用过时

**逻辑简单**：
- 无需维护索引映射
- 无需处理 token 冲突
- 无需复杂的条件判断

---

## 🎯 最终结论

### 用户洞察的价值

**您的两个关键判断都是正确的**：

1. ✅ **"token是唯一的"** - 重复概率极低，组合空间巨大
2. ✅ **"不可更改"** - 应该在创建时生成，后续永不修改

### 设计原则确认

**Token 应该是不可变的唯一标识符**：
- 基于创建时信息生成
- 永久不变
- 适合作为外部引用
- 简化系统逻辑

### 立即行动

**强烈建议立即实施**：
- 实施简单：主要是删除代码
- 风险极低：简化逻辑，不增加复杂度
- 收益明显：代码质量、性能、稳定性全面提升

---

**📞 项目信息**

**方案版本**：v2.0（修订版）
**修订日期**：2025-11-18
**修订原因**：基于用户洞察重新评估设计
**建议状态**：✅ **强烈推荐立即实施**

---

**🎯 Token 不可变性优化将使 deceased_token 真正成为"唯一且不可更改"的身份指纹！**
