# pallet-dust-bridge 测试指南

## 测试状态

✅ 测试框架已搭建  
⚠️ 部分测试需要修复所有权和类型问题

## 测试覆盖

已创建的测试用例：

### 桥接功能测试
- ✅ `test_bridge_to_arbitrum_works` - 正常桥接流程
- ✅ `test_bridge_amount_too_small` - 金额过小验证
- ✅ `test_bridge_amount_too_large` - 金额过大验证
- ✅ `test_bridge_insufficient_balance` - 余额不足验证
- ✅ `test_bridge_paused` - 桥接暂停状态验证
- ✅ `test_unlock_from_arbitrum_works` - 解锁DUST流程
- ✅ `test_unlock_duplicate_tx` - 防重放攻击验证

### 治理功能测试
- ✅ `test_create_proposal_works` - 创建提案
- ✅ `test_vote_works` - 投票功能
- ✅ `test_vote_already_voted` - 防止重复投票
- ✅ `test_execute_proposal_works` - 执行提案
- ✅ `test_execute_proposal_not_passed` - 未通过提案验证
- ✅ `test_execute_proposal_too_early` - 投票期验证

### 管理功能测试
- ✅ `test_set_arbitrum_bridge_address_works` - 设置合约地址
- ✅ `test_set_arbitrum_bridge_address_requires_root` - 权限验证
- ✅ `test_set_governance_config_works` - 设置治理配置

### 边界条件测试
- ✅ `test_bridge_lock_account_storage` - 桥接账户存储
- ✅ `test_next_bridge_id_increments` - ID 递增验证
- ✅ `test_max_bounded_vec_sizes` - 边界向量大小验证

## 待修复问题

1. **所有权问题**：部分测试中 `Vec<u8>` 的所有权转移需要添加 `.clone()`
2. **类型转换**：某些地方需要在 `Vec<u8>` 和 `BoundedVec` 之间转换

## 运行测试

```bash
# 编译测试（不运行）
cargo test -p pallet-dust-bridge --lib --no-run

# 运行所有测试
cargo test -p pallet-dust-bridge --lib

# 运行特定测试
cargo test -p pallet-dust-bridge --lib test_bridge_to_arbitrum_works
```

## 集成测试

集成测试应该在 runtime 层面进行，包括：
- OCW 与 Arbitrum RPC 的交互
- 治理提案的完整生命周期
- 跨多个 pallet 的交互

## 后续工作

- [ ] 修复所有编译错误
- [ ] 添加 OCW 模拟测试
- [ ] 添加更多边界条件测试
- [ ] 添加基准测试（benchmarking）
- [ ] 添加集成测试

