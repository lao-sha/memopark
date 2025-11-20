# Phase 3 Week 3 - 战略规划 📋

**日期**: 2025-10-25
**阶段**: Week 3（测试冲刺周）
**目标**: 完成6-8个新pallet测试
**策略**: 先易后难 + 快速迭代

---

## 🎯 Week 3 整体目标

### 核心指标
```
✅ 完成pallet数: 6-8个（新增）
✅ 测试覆盖率: 每个pallet 10-15测试
✅ 质量标准: 零编译警告 + README更新
✅ 时间控制: 每个pallet平均1-2小时
```

### 累计进度（截至Day 1结束）
```
总pallet数: 27个
已完成测试: 11个
完全通过: 6个
部分完成: 5个
待开始: 16个

Week 3目标: 16 → 10（完成6个新pallet）
```

---

## 📅 Week 3 每日计划

### ✅ Day 1: pallet-stardust-ipfs战略调整（已完成）
```
任务: stardust-ipfs测试 → 战略调整
结果: 8/19通过 + 11个标记为Week 4专项
耗时: 1小时
决策: 避免深坑，保持节奏
```

**关键成就**:
- ✅ 识别超高复杂度（⭐⭐⭐⭐⭐）
- ✅ 快速修复ExistentialDeposit
- ✅ 建立专项任务机制
- ✅ 保留8个核心测试

---

### Day 2: pallet-stardust-referrals（推荐）

**目标**: 推荐系统测试
**难度**: ⭐（简单CRUD）
**预计**: 2小时
**测试数**: 10-12个

#### 测试规划
```
Part 1: 基础功能（5测试）
1. register_referral_works           - 注册推荐关系
2. get_referrer_works                - 查询推荐人
3. register_duplicate_fails          - 重复注册失败
4. self_referral_fails               - 自我推荐失败
5. referral_chain_works              - 推荐链追踪

Part 2: 奖励管理（5测试）
6. record_reward_works               - 记录奖励
7. claim_reward_works                - 领取奖励
8. insufficient_reward_fails         - 余额不足失败
9. reward_accumulation_works         - 奖励累积
10. multiple_referrals_works         - 多层推荐
```

---

### Day 3: pallet-affiliate-config

**目标**: 联盟配置测试
**难度**: ⭐（简单配置）
**预计**: 1.5小时
**测试数**: 8-10个

#### 测试规划
```
Part 1: 配置管理（5测试）
1. set_config_works                  - 设置配置
2. update_config_works               - 更新配置
3. get_config_works                  - 查询配置
4. delete_config_works               - 删除配置
5. governance_only                   - 治理权限验证

Part 2: 参数验证（3-5测试）
6. invalid_rate_fails                - 无效比例失败
7. rate_bounds_check                 - 比例边界检查
8. config_constraints                - 配置约束验证
```

---

### Day 4: pallet-evidence + pallet-arbitration

**目标**: 证据管理 + 仲裁基础
**难度**: ⭐⭐（中等逻辑）
**预计**: 3小时（各1.5小时）

#### pallet-evidence测试（10测试）
```
Part 1: 证据提交（5测试）
1. submit_evidence_works             - 提交证据
2. submit_with_ipfs_works            - IPFS证据
3. duplicate_submission_fails        - 重复提交失败
4. evidence_by_case_works            - 按案件查询
5. evidence_pagination               - 证据分页

Part 2: 证据管理（5测试）
6. update_evidence_works             - 更新证据
7. delete_evidence_governance        - 治理删除
8. evidence_status_tracking          - 状态追踪
9. evidence_metadata_works           - 元数据验证
10. max_evidence_per_case            - 每案件最大数量
```

#### pallet-arbitration测试（10测试）
```
Part 1: 仲裁创建（5测试）
1. create_arbitration_works          - 创建仲裁
2. arbitration_roles_works           - 角色分配
3. arbitration_status_flow           - 状态流转
4. vote_on_arbitration_works         - 仲裁投票
5. finalize_arbitration_works        - 仲裁结案

Part 2: 高级功能（5测试）
6. arbitration_appeals               - 仲裁上诉
7. arbitrator_selection              - 仲裁员选择
8. arbitration_timeout               - 超时处理
9. arbitration_evidence_link         - 证据关联
10. arbitration_fee_distribution     - 费用分配
```

---

### Day 5: pallet-buyer-credit + pallet-maker-credit

**目标**: 信用体系测试
**难度**: ⭐⭐（信用计算）
**预计**: 3小时（各1.5小时）

#### pallet-buyer-credit测试（10测试）
```
Part 1: 信用记录（5测试）
1. initialize_credit_works           - 初始化信用
2. record_order_works                - 记录订单
3. update_credit_score               - 更新信用分
4. credit_decay_works                - 信用衰减
5. credit_history_tracking           - 历史追踪

Part 2: 信用评估（5测试）
6. good_behavior_bonus               - 良好行为加分
7. bad_behavior_penalty              - 不良行为扣分
8. credit_level_tiers                - 信用等级
9. credit_based_limits               - 信用限额
10. credit_restoration               - 信用恢复
```

#### pallet-maker-credit测试（10测试）
```
Part 1: 做市商信用（5测试）
1. maker_credit_init                 - 初始化做市商信用
2. order_fulfillment_credit          - 订单履约信用
3. response_time_credit              - 响应时间信用
4. dispute_impact_credit             - 争议影响信用
5. maker_credit_ranking              - 做市商排名

Part 2: 信用激励（5测试）
6. high_credit_benefits              - 高信用奖励
7. low_credit_restrictions           - 低信用限制
8. credit_recovery_path              - 信用恢复路径
9. maker_reputation_score            - 声誉评分
10. credit_based_matching            - 信用匹配
```

---

## 🎯 优先级矩阵

### 高优先级（Week 3 Day 2-3）
```
✅ pallet-stardust-referrals      - ⭐ 简单CRUD
✅ pallet-affiliate-config     - ⭐ 简单配置
✅ pallet-evidence             - ⭐⭐ 中等存储
```

### 中优先级（Week 3 Day 4-5）
```
□ pallet-arbitration          - ⭐⭐ 中等逻辑
□ pallet-buyer-credit         - ⭐⭐ 信用计算
□ pallet-maker-credit         - ⭐⭐ 信用计算
```

### 低优先级（Week 4+）
```
⏸ pallet-simple-bridge        - ⭐⭐⭐ 跨链逻辑
⏸ pallet-deposits             - ⭐⭐⭐ 托管扩展
⏸ pallet-stardust-ipfs（专项）    - ⭐⭐⭐⭐⭐ 超高复杂度
⏸ pallet-otc-order（专项）    - ⭐⭐⭐⭐ 依赖地狱
```

---

## 📊 成功标准

### 每个Pallet的验收标准
```
✅ 测试数量: 10-15个
✅ 测试通过率: 100%
✅ 编译警告: 0个
✅ 测试分类: Part1基础 + Part2高级
✅ README更新: 包含测试说明
✅ 代码注释: 函数级中文注释
```

### Week 3整体验收
```
✅ 新完成pallet: 6-8个
✅ 累计测试数: 150-200个新增测试
✅ 整体通过率: >95%
✅ 文档完整性: 每个pallet有README
```

---

## 🛠 测试模板（标准化）

### 简单CRUD测试模板
```rust
#[test]
fn basic_create_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        
        // 1. 准备数据
        let creator = 1u64;
        let data = "test_data";
        
        // 2. 执行操作
        assert_ok!(Pallet::create(
            RuntimeOrigin::signed(creator),
            data.into()
        ));
        
        // 3. 验证存储
        assert!(Storage::<Test>::contains_key(creator));
        
        // 4. 验证事件
        System::assert_has_event(Event::Created(creator).into());
    });
}
```

### 边界条件测试模板
```rust
#[test]
fn operation_fails_on_invalid_input() {
    new_test_ext().execute_with(|| {
        let caller = 1u64;
        
        // 测试无效输入
        assert_noop!(
            Pallet::operation(
                RuntimeOrigin::signed(caller),
                invalid_data
            ),
            Error::<Test>::InvalidInput
        );
    });
}
```

---

## 💡 Week 3 策略

### 1. 快速迭代 ⚡
```
每个pallet目标: 1-2小时
避免深坑: 复杂pallet转专项
保持节奏: 连续完成6-8个
```

### 2. 质量优先 ✅
```
零编译警告
100%测试通过
完整文档更新
```

### 3. 灵活调整 🎯
```
遇到复杂pallet: 标记为Week 4专项
简单pallet: 快速完成并前进
中等pallet: 分Part完成
```

---

## 📈 进度追踪

### Week 3 目标达成率
```
Day 1: 1/6 完成（stardust-ipfs战略调整）✅
Day 2: 目标2/6（+referrals）
Day 3: 目标3/6（+affiliate-config）
Day 4: 目标5/6（+evidence +arbitration）
Day 5: 目标7/6（+buyer-credit +maker-credit）超额完成！
```

---

**Week 3 Day 2 启动！目标：pallet-stardust-referrals** 🚀

