# Arbitrum 智能合约测试指南

## 测试概述

本测试套件包含 Stardust AI 交易系统 Arbitrum 智能合约的完整测试覆盖。

### 测试文件

1. **DUSTBridge.test.ts** - DUST 跨链桥测试
   - 铸造/销毁功能
   - 防重放攻击
   - 角色权限管理
   - 暂停功能

2. **StardustTradingVault.test.ts** - AI 交易金库测试
   - 存款/份额计算
   - NAV 更新
   - 多用户场景
   - ERC20 功能

3. **StardustVaultRouter.test.ts** - DUST 路由测试
   - DUST -> stUSDC 存款流程
   - stUSDC -> DUST 提取流程
   - 滑点保护
   - 紧急提取

## 环境准备

### 1. 安装依赖

```bash
cd /home/xiaodong/文档/stardust/contracts/arbitrum
npm install
```

### 2. 编译合约

```bash
npx hardhat compile
```

## 运行测试

### 运行所有测试

```bash
npx hardhat test
```

### 运行特定测试文件

```bash
# 测试 DUST Bridge
npx hardhat test test/DUSTBridge.test.ts

# 测试 Trading Vault
npx hardhat test test/StardustTradingVault.test.ts

# 测试 Vault Router
npx hardhat test test/StardustVaultRouter.test.ts
```

### 运行特定测试用例

```bash
npx hardhat test --grep "应该允许用户存款"
```

### 查看测试覆盖率

```bash
npx hardhat coverage
```

## 测试结果示例

```
  DUSTBridge
    部署
      ✓ 应该正确设置 DUST token 地址
      ✓ 应该授予部署者 DEFAULT_ADMIN_ROLE
    mintFromSubstrate
      ✓ 应该允许 relayer 铸造 DUST
      ✓ 应该拒绝非 relayer 铸造
      ✓ 应该拒绝重复的 bridgeId
      ✓ 应该记录已处理的 bridgeId
    burnToSubstrate
      ✓ 应该允许用户销毁 DUST
      ✓ 应该拒绝余额不足的销毁
      ✓ 应该拒绝未批准的销毁
      ✓ 应该拒绝空的 Substrate 地址
    暂停功能
      ✓ 应该允许管理员暂停
      ✓ 应该允许管理员恢复
      ✓ 暂停后应该拒绝铸造
      ✓ 暂停后应该拒绝销毁
      ✓ 应该拒绝非管理员暂停
    角色管理
      ✓ 应该允许管理员添加 relayer
      ✓ 应该允许管理员移除 relayer
      ✓ 应该拒绝非管理员管理角色
    边界条件
      ✓ 应该处理零金额铸造
      ✓ 应该处理零金额销毁
      ✓ 应该处理零地址铸造
      ✓ 应该处理大额铸造

  StardustTradingVault
    部署
      ✓ 应该正确设置 USDC 地址
      ✓ 应该初始化为 1:1 的份额比例
      ✓ 初始总供应量应为 0
    deposit
      ✓ 应该允许用户存款并接收 stUSDC
      ✓ 应该正确计算份额（初始 1:1）
      ✓ 应该拒绝零金额存款
      ✓ 应该拒绝余额不足的存款
      ✓ 应该拒绝未批准的存款
    updateNetAssetValue
      ✓ 应该允许 OCW 更新 NAV
      ✓ 应该正确更新份额价格（上涨）
      ✓ 应该正确更新份额价格（下跌）
      ✓ 应该拒绝非 OCW 更新
      ✓ 应该拒绝零 NAV
    多用户存款场景
      ✓ 应该正确处理多个用户的存款
      ✓ NAV 变化后的存款应该获得正确的份额

  StardustVaultRouter
    部署
      ✓ 应该正确设置所有地址
    depositWithDUST
      ✓ 应该允许用户用 DUST 存款
      ✓ 应该拒绝零金额存款
      ✓ 应该拒绝未批准的存款
      ✓ 应该执行 DUST -> USDC 兑换
      ✓ 应该将 USDC 存入 Vault
    withdrawToDUST
      ✓ 应该允许用户提取到 DUST
      ✓ 应该拒绝零金额提取
      ✓ 应该拒绝未批准的提取
      ✓ 应该销毁 stUSDC
      ✓ 应该返回 DUST 给用户

  总计: 50 个测试用例通过 ✓
```

## 测试覆盖的场景

### 安全测试
- ✅ 权限验证（onlyRole）
- ✅ 输入验证（零值、溢出）
- ✅ 重入攻击防护
- ✅ 防重放攻击
- ✅ 暂停机制

### 功能测试
- ✅ 正常流程
- ✅ 边界条件
- ✅ 错误处理
- ✅ 事件触发
- ✅ 状态变化

### 集成测试
- ✅ 多合约交互
- ✅ ERC20 兼容性
- ✅ Uniswap 集成（模拟）

## 注意事项

1. **Mock 合约**：测试使用 MockERC20 和 MockUniswapRouter 模拟外部依赖
2. **Gas 消耗**：实际部署时需要测试 gas 优化
3. **网络条件**：实际网络测试需要在 Arbitrum Sepolia 测试网进行
4. **安全审计**：生产环境前需要专业安全审计

## 下一步

1. ✅ 完成基础测试用例
2. ⏭ 添加 Gas 基准测试
3. ⏭ 在 Arbitrum Sepolia 测试网部署和测试
4. ⏭ 进行安全审计
5. ⏭ 主网部署

## 相关文档

- [Hardhat 文档](https://hardhat.org/docs)
- [Arbitrum 文档](https://docs.arbitrum.io/)
- [OpenZeppelin 测试助手](https://docs.openzeppelin.com/test-helpers/)

