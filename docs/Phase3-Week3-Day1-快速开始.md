# Phase 3 Week 3 Day 1 - 快速开始 🚀

**日期**: 2025-10-25
**任务**: pallet-stardust-ipfs 回补测试
**目标**: 添加10个新测试（当前5个→目标15个）
**预计**: 1.5小时

---

## 📋 任务概览

### pallet-stardust-ipfs 现状
```
✅ 已完成: 5个测试通过
✅ 依赖清理: 已移除pallet-memo-endowment
✅ Mock框架: 完整可用
⏳ 待添加: 10个新测试
```

### 测试策略
```
Part 1: 现有测试（5个）✅
Part 2: 新增测试（10个）⏳

总目标: 15个测试
难度: ⭐⭐
```

---

## 🎯 10个新测试规划

### Part 2A: 公共费用配额管理（3测试，30分钟）
```rust
6. set_public_fee_quota_works           - 设置公共费用配额
7. public_quota_usage_tracking          - 配额使用追踪
8. public_quota_exhausted               - 配额耗尽处理
```

**关键逻辑**:
- 管理员设置公共配额
- Pin操作消耗配额
- 配额不足时行为验证

### Part 2B: 三重收费机制（3测试，30分钟）
```rust
9. triple_charge_pool_success           - 资金池支付成功
10. triple_charge_subject_fallback      - 主体资金后备
11. triple_charge_caller_final          - 调用者最终支付
```

**收费顺序**:
1. Pool（资金池）
2. Subject Funding（主体资金）
3. Caller（调用者）

### Part 2C: Pin元数据验证（2测试，20分钟）
```rust
12. pin_meta_storage_works              - Pin元数据存储
13. pin_subject_tracking                - 主体关联追踪
```

**验证内容**:
- PinMeta结构正确存储
- Subject → CID 映射关系

### Part 2D: 边界条件（2测试，10分钟）
```rust
14. invalid_cid_format                  - 无效CID格式
15. duplicate_pin_handling              - 重复Pin处理
```

---

## 📁 文件结构

```
pallets/stardust-ipfs/
├── src/
│   ├── lib.rs          ✅ 已存在
│   ├── mock.rs         ✅ 已存在（已清理依赖）
│   └── tests.rs        ⏳ 需要添加10个测试
└── Cargo.toml          ✅ 已更新
```

---

## 🔍 查看现有测试

### 步骤1: 检查现有5个测试（5分钟）
```bash
cd /home/xiaodong/文档/stardust
cat pallets/stardust-ipfs/src/tests.rs | grep "^fn " | head -10
```

**目的**: 了解现有测试模式，保持一致性

---

## 📝 新测试模板

### 模板1: 配额管理测试
```rust
#[test]
fn set_public_fee_quota_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        
        let quota = 1000u64;
        
        // Root设置公共配额
        assert_ok!(IpfsPinner::set_public_fee_quota(
            RuntimeOrigin::root(),
            quota,
        ));
        
        // 验证配额设置
        assert_eq!(
            crate::PublicFeeQuotaUsage::<Test>::get(),
            (0, quota) // (used, total)
        );
    });
}
```

### 模板2: 三重收费测试
```rust
#[test]
fn triple_charge_pool_success() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        
        let cid = b"QmTest123".to_vec();
        let pool_initial = Balances::free_balance(&IpfsPinner::pool_account());
        
        // Pin操作（应从Pool扣费）
        assert_ok!(IpfsPinner::pin_cid(
            RuntimeOrigin::signed(1),
            cid.clone(),
            None, // subject
        ));
        
        // 验证Pool余额减少
        let pool_after = Balances::free_balance(&IpfsPinner::pool_account());
        assert!(pool_after < pool_initial);
    });
}
```

### 模板3: 元数据验证测试
```rust
#[test]
fn pin_meta_storage_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        
        let cid = b"QmTest123".to_vec();
        let pinner = 1u64;
        
        // Pin操作
        assert_ok!(IpfsPinner::pin_cid(
            RuntimeOrigin::signed(pinner),
            cid.clone(),
            None,
        ));
        
        // 验证PinMeta存储
        let meta = crate::PinMeta::<Test>::get(&cid);
        assert!(meta.is_some());
        assert_eq!(meta.unwrap().pinner, pinner);
    });
}
```

---

## ⚡ 执行步骤

### 步骤1: 查看lib.rs接口（10分钟）
```bash
cd /home/xiaodong/文档/stardust
grep "pub fn " pallets/stardust-ipfs/src/lib.rs | head -20
```
**目的**: 确认可用的extrinsic和trait方法

### 步骤2: 查看现有tests.rs（5分钟）
```bash
cat pallets/stardust-ipfs/src/tests.rs
```
**目的**: 了解测试风格和helper函数

### 步骤3: 添加10个新测试（60分钟）
- Part 2A: 配额管理（3个，30分钟）
- Part 2B: 三重收费（3个，30分钟）
- Part 2C: 元数据验证（2个，20分钟）
- Part 2D: 边界条件（2个，10分钟）

### 步骤4: 编译验证（10分钟）
```bash
cargo test -p pallet-stardust-ipfs --lib
```

### 步骤5: 修复错误（15分钟预留）

---

## 🎯 验收标准

- ✅ 15/15 测试通过（5现有 + 10新增）
- ✅ 零编译警告
- ✅ 覆盖核心功能：配额/收费/元数据/边界
- ✅ tests.rs < 600行（当前约150行）

---

## 📊 关键检查点

### Checkpoint 1（30分钟）
- ✅ 查看接口完成
- ✅ Part 2A完成（3测试）

### Checkpoint 2（60分钟）
- ✅ Part 2B完成（6/10测试）

### Checkpoint 3（80分钟）
- ✅ Part 2C+2D完成（10/10测试）

### Checkpoint 4（90分钟）
- ✅ 全部编译通过（15/15）
- ✅ Week 3 Day 1完成！

---

## 💡 关键注意事项

### IpfsPinner Trait接口
```rust
pub trait IpfsPinner<AccountId> {
    fn pin_cid(cid: Vec<u8>, subject: Option<Subject>) -> DispatchResult;
    fn pin_cid_for_deceased(deceased_id: u64, cid: Vec<u8>) -> DispatchResult;
    fn pin_cid_for_grave(grave_id: u64, cid: Vec<u8>) -> DispatchResult;
}
```

### 关键存储
```rust
PinMeta<T>: StorageMap<CID, PinMetadata>
PinSubjectOf<T>: StorageMap<CID, Subject>
PublicFeeQuotaUsage<T>: StorageValue<(used, total)>
IpfsPoolAccount<T>: 资金池账户
OperatorEscrowAccount<T>: 操作员托管账户
```

### 事件
```rust
PinRequested { cid, pinner, subject }
PinCompleted { cid }
QuotaUpdated { new_quota }
```

---

## 🚀 开始行动

**第一步**: 查看pallet-stardust-ipfs/src/lib.rs的extrinsic定义
**时间**: 现在！
**预期完成**: 1.5小时后（15个测试通过）

---

**准备好了吗？让我们启动Week 3 Day 1！** 🎯

