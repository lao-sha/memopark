# batch-transfer.js 批量转账脚本使用说明

## 修改内容总结

### 1. 账户数量调整
- **原配置**: 创建 1000 个账户
- **新配置**: 创建 100 个账户

### 2. 相关配置调整
```javascript
const BATCH_CONFIG = {
  accountCount: 100,                      // 创建账户数量（从1000改为100）
  minAmount: 20_000_000n,                 // 最小转账金额（20,000,000 DUST）
  maxAmount: 50_000_000n,                 // 最大转账金额（50,000,000 DUST）
  accountsFile: 'generated-accounts-100.json', // 账户信息保存文件（已更名）
  resultsFile: 'transfer-results-100.json',   // 转账结果保存文件（已更名）
  batchSize: 25,                          // 每批处理数量（从50改为25）
  delayBetweenBatches: 3000,              // 批次间延迟（毫秒）
  delayBetweenTxs: 500,                   // 交易间延迟（毫秒）
};
```

### 3. 进度显示优化
- 从每100个显示进度改为每25个显示进度
- 最后一个账户也会显示进度

## 功能说明

### 主要功能
1. **生成100个新账户**，每个账户包含：
   - 助记词（12个单词）
   - 账户地址（SS58格式）
   - 序号（1-100）

2. **记录账户信息**到JSON文件：
   - 文件名：`generated-accounts-100.json`
   - 包含完整的助记词和地址信息
   - 带时间戳标记

3. **批量转账**到这100个地址：
   - 每个地址随机转入 20,000,000 - 50,000,000 DUST
   - 每批处理25个账户
   - 自动重试和错误处理

## 使用步骤

### 1. 执行脚本
```bash
cd /home/xiaodong/文档/stardust/stardust-gov-scripts
node batch-transfer.js
```

### 2. 查看生成的账户文件
```bash
cat generated-accounts-100.json
```

生成的JSON文件格式：
```json
{
  "timestamp": "2025-10-24T10:30:00.000Z",
  "count": 100,
  "accounts": [
    {
      "index": 1,
      "address": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
      "mnemonic": "word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12"
    },
    {
      "index": 2,
      "address": "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
      "mnemonic": "another1 another2 another3 another4 another5 another6 another7 another8 another9 another10 another11 another12"
    }
    // ... 共100个账户
  ]
}
```

### 3. 查看转账结果
```bash
cat transfer-results-100.json
```

转账结果文件格式：
```json
{
  "timestamp": "2025-10-24T10:35:00.000Z",
  "totalCount": 100,
  "successCount": 100,
  "failCount": 0,
  "results": [
    {
      "index": 1,
      "recipient": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
      "amount": "25000000000000000000",
      "amountFormatted": "25000000 DUST",
      "success": true,
      "blockHash": "0x1234...",
      "timestamp": "2025-10-24T10:31:00.000Z"
    }
    // ... 共100条记录
  ]
}
```

## 安全提示

### ⚠️ 重要：妥善保管助记词！

1. **generated-accounts-100.json 包含所有账户的助记词**
   - 这是恢复账户的唯一凭证
   - 任何人获得助记词即可控制账户资金
   - 请将文件保存到安全位置

2. **建议操作**：
   ```bash
   # 备份到安全位置
   cp generated-accounts-100.json ~/secure-backups/
   
   # 设置文件权限（仅当前用户可读）
   chmod 600 generated-accounts-100.json
   
   # 或加密保存
   gpg -c generated-accounts-100.json
   ```

3. **不要**：
   - 不要将文件上传到公开的代码仓库
   - 不要通过不安全的通道传输
   - 不要在公共场所打开查看

## 执行流程

脚本执行时的步骤：

1. **加密库初始化** ✅
2. **验证发送账户** ✅
3. **连接到区块链节点** ✅
4. **检查发送账户余额** 💰
5. **生成100个新账户** 🔑
   - 每个账户生成独立的助记词
   - 从助记词派生账户地址
   - 显示进度（每25个）
6. **保存账户信息到文件** 💾
7. **生成转账列表** 📋
   - 为每个账户生成随机金额
   - 计算总金额和预估手续费
8. **执行批量转账** 💸
   - 分4批次处理（每批25个）
   - 每笔交易显示详细状态
   - 实时保存中间结果
9. **显示最终统计** 📊
10. **保存完整结果** 📁

## 预期输出示例

```
🚀 批量创建账户并随机转账脚本启动

============================================================
配置信息:
   账户数量: 100
   转账范围: 20000000-50000000 DUST
   批次大小: 25
   发送地址: 5CrDBEVDgXUwctSuV8EvQEBo2m187PcxoY36V7H7PGErHUW4
============================================================

✅ 加密库准备完成
✅ 发送账户地址验证通过
   地址: 5CrDBEVDgXUwctSuV8EvQEBo2m187PcxoY36V7H7PGErHUW4

🔌 正在连接节点: ws://127.0.0.1:9944
✅ 已连接 Stardust Network • stardust v1.0.0
   代币: DUST (精度: 12)

💰 检查账户余额...
   可用余额: 10000000000 DUST

🔑 开始生成 100 个账户...
============================================================
   ✅ 已生成 25/100 个账户
   ✅ 已生成 50/100 个账户
   ✅ 已生成 75/100 个账户
   ✅ 已生成 100/100 个账户
✅ 账户生成完成！共 100 个

💾 保存账户信息到文件: generated-accounts-100.json
✅ 账户信息已保存
   文件路径: /home/xiaodong/文档/stardust/stardust-gov-scripts/generated-accounts-100.json
   账户数量: 100

... [转账过程] ...

============================================================
📊 批量转账完成
============================================================
✅ 成功: 100 笔
❌ 失败: 0 笔
📝 总计: 100 笔
📈 成功率: 100.00%

👋 脚本执行完成

📁 生成的文件:
   账户信息: /home/xiaodong/文档/stardust/stardust-gov-scripts/generated-accounts-100.json
   转账结果: /home/xiaodong/文档/stardust/stardust-gov-scripts/transfer-results-100.json
```

## 故障处理

### 如果脚本中断
- 账户信息已保存到文件，再次运行会自动加载
- 可以继续未完成的转账
- 中间结果已保存在 transfer-results-100.json

### 如果需要重新生成账户
```bash
# 删除旧的账户文件
rm generated-accounts-100.json

# 重新运行脚本
node batch-transfer.js
```

## 技术细节

- **加密算法**: sr25519
- **助记词标准**: BIP39（12个单词）
- **地址格式**: SS58（Substrate地址格式）
- **转账方式**: transferKeepAlive（保留最小存在余额）

## 文件列表

执行后生成的文件：
1. `generated-accounts-100.json` - 100个账户的完整信息（含助记词）
2. `transfer-results-100.json` - 100笔转账的详细结果

## 下一步操作

生成账户后，你可以：
1. 导入这些账户到钱包
2. 使用助记词恢复账户
3. 查询账户余额
4. 进行后续的测试操作

---

**提醒**: 这是测试脚本，请在开发环境中使用。主网操作请格外小心！

