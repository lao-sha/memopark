# Phase 3 Week 1 Day 3 - 快速开始

> **任务**: pallet-deceased测试  
> **策略**: 🎯 **快速聚焦核心功能**  
> **目标**: 18个测试，专注CRUD  

---

## 📊 策略调整

### 吸取Day 2经验

**Day 2教训**:
- ❌ pallet-stardust-grave: 55 extrinsics，复杂依赖
- ❌ 3小时仅完成70%
- ✅ 但测试代码质量高，可复用

**Day 3策略**:
- ✅ 专注核心CRUD（create, update, transfer, remove）
- ✅ 简化Mock，避开IPFS依赖
- ✅ 目标2小时完成编译通过
- ✅ 保持节奏向前

---

## 🎯 测试范围

### 核心功能（18个测试）

**创建和基础**  (5个):
1. create_deceased_works
2. create_with_grave
3. create_multiple_increments_id
4. create_validates_grave
5. create_requires_permission

**更新** (3个):
6. update_deceased_by_owner
7. update_requires_ownership
8. update_nonexistent_fails

**转移** (4个):
9. transfer_deceased_works
10. transfer_updates_grave
11. transfer_requires_permission
12. transfer_to_invalid_grave_fails

**拥有者转移** (2个):
13. transfer_owner_works
14. transfer_owner_requires_current_owner

**移除** (2个):
15. remove_deceased_works
16. remove_requires_ownership

**治理操作** (2个):
17. gov_transfer_deceased_works
18. gov_operations_require_governance

---

## ⚡ 执行计划

**时间分配**:
- Mock创建: 30分钟
- 测试编写: 60分钟
- 编译调试: 30分钟
- **总计**: 2小时

**简化策略**:
- 跳过关系管理测试（propose_relation等）
- 跳过好友功能测试（request_join等）
- 跳过IPFS相关测试
- 专注18个核心CRUD测试

---

## 🚀 立即开始！

**Step 1**: 创建简化Mock（30分钟）  
**Step 2**: 编写18个核心测试（60分钟）  
**Step 3**: 编译通过（30分钟）  

💪 **目标明确，快速执行！**

