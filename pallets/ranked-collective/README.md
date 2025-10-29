# Ranked Collective System（分级集体治理系统）

## 概述

这是一个成员管理 pallet，提供了与投票系统（如 Referenda pallet）配合使用的 `Tally` 实现。
每个成员都有一个等级（rank），0 为最低级。系统对成员数量和等级数量没有复杂度限制，
因此可以支持潜在的公开成员资格。

## 核心特性

### 分级成员管理
- **等级制度**：成员拥有等级（Rank），0 为最低级，理论上无上限
- **渐进式晋升/降级**：成员每次只能晋升或降级一个等级
- **O(1) 操作**：大部分操作的时间复杂度为 O(1)
- **例外**：`remove_member` 操作需要从当前等级逐级降至 0，时间复杂度 O(n)
- **随机选择**：可以在 O(1) 时间内从特定等级随机选择成员

### 加权投票系统
- **不同等级拥有不同投票权重**
- **权限累积**：高等级可参与低等级的投票
- **投票权重**：高等级在任何投票中的权重至少与低等级相同

### 等级权限控制

两个 `Config` trait 项控制"等级权限"：

1. **`MinRankOfClass`**：控制哪些等级可以对特定类别的提案投票
2. **`VoteWeight`**：根据投票者等级和提案的最低等级要求计算投票权重

### Origin 权限验证

提供 `EnsureRank` origin 控制，确保调用者是集体成员且达到特定等级。

---

## Memopark 项目集成状态

### ⚠️ 当前状态：**未集成**

本 pallet 已存在于 Memopark 项目中，但**尚未在 Runtime 中集成**。

### 是否需要使用？

**结论：暂时不建议使用**

**理由：**

1. **功能重叠**
   - Memopark 已有三个 `pallet-collective` 实例（Council、TechnicalCommittee、ContentCommittee）
   - 现有体系已满足当前的治理需求

2. **项目定位不匹配**
   - Memopark 是纪念园服务平台，核心业务是墓地管理、逝者纪念、供奉系统
   - 不是复杂的链上治理平台，无需精细化等级体系

3. **增加系统复杂度**
   - 需要设计等级体系、晋升标准、权重分配
   - 增加开发成本、运营成本和用户理解成本
   - 前端需要额外的等级显示和晋升流程

4. **时机未到**
   - 当前委员会成员数量有限
   - 治理提案数量不多
   - 社区规模尚未达到需要精细化分级的阈值

### 适用场景（未来可能）

如果未来出现以下情况，可以考虑引入 Ranked Collective：

#### 场景1：社区规模扩大
- **触发条件**：委员会成员超过 50 人，月度治理提案 > 20 个
- **适用方式**：将 ContentCommittee 升级为 Ranked Collective
- **等级设计**：见习审核员 → 初级 → 中级 → 高级 → 专家 → 首席

#### 场景2：专业技能分级
- **触发条件**：需要根据专业能力分配审核权限
- **适用方式**：建立技术贡献者分级体系
- **等级设计**：贡献者 → 维护者 → 核心开发者 → 架构师 → 技术主管

#### 场景3：与 OpenGov 集成
- **触发条件**：Memopark 成为 Polkadot 平行链
- **适用方式**：使用 Ranked Collective 作为 Fellowship 实现
- **集成方式**：与 Polkadot 的 Referenda 系统对接

### 替代方案（当前推荐）

在引入 Ranked Collective 之前，可以先尝试这些低成本方案：

1. **增强现有 pallet-collective**
   - 引入 Prime 成员机制（已支持）
   - 设置不同的多数阈值（已支持）
   - 增加委员会实例数量

2. **基于 pallet-membership 的简化分级**
   - 在现有会员系统中增加权限标识
   - 通过会员等级控制治理参与

3. **链下治理 + 链上执行**
   - 使用 Snapshot 等工具进行链下投票
   - 委员会根据链下投票结果执行链上提案

---

## 详细设计方案

如需了解完整的适配方案设计（包括等级体系、权限矩阵、晋升标准、Runtime 配置、前端集成等），
请参阅：`docs/Ranked-Collective-适配方案.md`

---

## 参考资料

- [Polkadot Fellowship 设计](https://github.com/polkadot-fellows/RFCs)
- [pallet-ranked-collective 源码](https://github.com/paritytech/polkadot-sdk/tree/master/substrate/frame/ranked-collective)
- [Substrate 治理最佳实践](https://docs.substrate.io/reference/how-to-guides/pallet-design/add-governance-capabilities/)

---

**最后更新**：2025-10-23  
**状态**：未集成（保留作为未来扩展选项）
