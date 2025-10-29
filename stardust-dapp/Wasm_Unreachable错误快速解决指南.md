# Wasm Unreachable 错误快速解决指南

## 🚨 问题描述

提交做市商资料时遇到错误：
```
wasm trap: wasm `unreachable` instruction executed
```

## ✅ 已完成的修复（v1.1.0）

我们已经添加了以下防护措施：

### 1. 参数长度验证 ✅
- ✅ epay 网关地址：最大 128 字节
- ✅ epay 商户 ID：最大 64 字节
- ✅ epay 商户密钥：最大 64 字节

### 2. 参数范围验证 ✅
- ✅ epay 端口：1-65535
- ✅ 首购资金池：>= 10,000 MEMO

### 3. 余额充足性检查 ✅
- ✅ 自动检查可用余额
- ✅ 提前警告余额不足

### 4. 大数精度修复 ✅
- ✅ 正确处理 10,000+ MEMO 的大额

### 5. 详细调试日志 ✅
- ✅ 打印所有参数
- ✅ 显示余额信息

---

## 🔍 第一步：查看控制台日志

### 1. 打开开发者工具

- **Chrome/Edge**: 按 `F12` 或 `Ctrl+Shift+I`
- **Firefox**: 按 `F12`
- **Safari**: `Cmd+Option+I`

### 2. 切换到 Console 标签

![控制台](https://via.placeholder.com/800x100/1890ff/ffffff?text=Console+Tab)

### 3. 提交资料并查看日志

应该看到类似输出：

```
💰 [余额检查]
  可用余额: 50000.00 MEMO
  已锁定: 10000.00 MEMO
  需要锁定: 10000 MEMO（首购资金池）

📤 [submitInfo] 提交参数详情
  mmId: 0
  fee: 100 (u16)
  minAmt: 100 MEMO → formatted: 100000000000000
  pool: 10000 MEMO → formatted: 10000000000000000000
  epay_gateway: http://127.0.0.1 → bytes: 16 字节
  epay_port: 8080 (u16)
  epay_pid: 12345 → bytes: 5 字节
  epay_key: test123*** → bytes: 10 字节
```

---

## 🛠️ 第二步：检查常见问题

### 问题 1：余额不足 ❌

**症状：**
```
错误：余额不足：可用 5000.00 MEMO，但需要 10000 MEMO
```

**解决方法：**
1. 查看可用余额：`可用余额: X MEMO`
2. 查看需要金额：`需要锁定: Y MEMO`
3. 确保 `X >= Y`

**充值方法：**
- 方法 1：从其他账户转账
- 方法 2：降低首购资金池金额（最低 10,000 MEMO）
- 方法 3：联系团队获取测试币

---

### 问题 2：配置字段超长 ❌

**症状：**
```
错误：epay 支付网关地址超过 128 字节限制
```

**解决方法：**
1. 检查日志：`epay_gateway: ... → bytes: X 字节`
2. 确保：
   - epay_gateway <= 128 字节 ✅
   - epay_pid <= 64 字节 ✅
   - epay_key <= 64 字节 ✅

**示例：**
```
✅ 正确: http://127.0.0.1:8080 (22 字节)
❌ 错误: http://very-very-very-long-domain-name.com/api/v1/payment/gateway (65 字节，但如果太长就超限)
```

---

### 问题 3：端口号错误 ❌

**症状：**
```
错误：epay 端口必须小于等于 65535
```

**解决方法：**
1. 检查日志：`epay_port: X (u16)`
2. 确保：`1 <= X <= 65535`

**示例：**
```
✅ 正确: 80, 443, 8080, 3000
❌ 错误: 0, 100000, -1
```

---

### 问题 4：精度问题（已自动修复）✅

如果你输入了大额（如 100,000 MEMO），现在应该正常工作。

**验证方法：**
查看日志：
```
pool: 100000 MEMO → formatted: 100000000000000000000
```

确认 `formatted` 是一个**20位整数**（100000 * 10^12）。

---

## 📋 第三步：参数检查清单

提交前，请确认：

| 项目 | 要求 | 检查 |
|------|------|------|
| **余额** | 可用余额 >= 首购资金池 | [ ] |
| **首购资金池** | >= 10,000 MEMO | [ ] |
| **epay 网关** | <= 128 字节，非空 | [ ] |
| **epay 端口** | 1-65535 | [ ] |
| **epay 商户ID** | <= 64 字节，非空 | [ ] |
| **epay 商户密钥** | <= 64 字节，非空 | [ ] |
| **公开 CID** | 有效的 IPFS CID | [ ] |
| **私密 CID** | 有效的 IPFS CID | [ ] |
| **费率** | 0-10000 bps | [ ] |
| **最小下单额** | > 0 | [ ] |

---

## 🧪 第四步：测试提交

### 推荐配置（测试用）

```
公开资料 CID: QmTest1111111111111111111111111111111111111111111
私密资料 CID: QmTest2222222222222222222222222222222222222222222
费率（bps）: 100
最小下单额: 100
epay 支付网关: http://127.0.0.1
epay 端口: 8080
epay 商户ID: test12345
epay 商户密钥: testkey123
首购资金池: 10000
```

---

## 🚀 第五步：如果仍然失败

### 1. 复制诊断信息

在浏览器控制台（Console）中执行：

```javascript
// 复制这段代码，粘贴到控制台，按回车
(async () => {
  console.group('🔍 诊断信息')
  
  // 基本信息
  console.log('当前地址:', localStorage.getItem('mp.current'))
  console.log('mmId:', localStorage.getItem('mm_apply_id'))
  console.log('申请步骤:', localStorage.getItem('mm_apply_step'))
  
  // 查询余额
  try {
    const api = await getApi()
    const address = localStorage.getItem('mp.current')
    const accountInfo = await api.query.system.account(address)
    const data = accountInfo.toJSON()
    console.log('账户余额:', {
      free: (Number(data.data.free) / 1e12).toFixed(2) + ' MEMO',
      reserved: (Number(data.data.reserved) / 1e12).toFixed(2) + ' MEMO',
    })
  } catch (e) {
    console.error('查询余额失败:', e)
  }
  
  console.groupEnd()
})()
```

### 2. 截图以下内容

1. **控制台所有日志**（包括红色错误）
2. **余额检查日志**（💰 [余额检查]）
3. **参数详情日志**（📤 [submitInfo] 提交参数详情）
4. **诊断信息**（🔍 诊断信息）

### 3. 提供反馈

将截图和以下信息发送给技术支持：
- 错误完整文本
- 控制台日志截图
- 你输入的参数值
- 账户地址

---

## 💡 常见问题 FAQ

### Q1: 为什么需要这么多余额？

**A:** 提交资料时需要：
- 已锁定保证金：10,000 MEMO（在第一步质押时）
- 首购资金池：10,000 MEMO（在第二步提交资料时）
- 交易费用：约 0.01 MEMO
- **总计：至少 20,000.01 MEMO**

### Q2: 可以降低首购资金池吗？

**A:** 最低 10,000 MEMO，不能更低。这是为了确保：
- 可服务约 100 个新用户（100 MEMO/人）
- 充值频率合理（10-20 天一次）
- 服务稳定性

### Q3: epay 配置填什么？

**A:** 如果你还没有 epay 配置，可以：
- **测试环境**: 填写任意有效格式即可
  ```
  网关: http://127.0.0.1
  端口: 8080
  商户ID: test12345
  商户密钥: testkey123
  ```
- **生产环境**: 联系 epay 服务商获取真实配置

### Q4: 提交后可以修改吗？

**A:** 可以！在审核前可以调用 `update_info` 修改。

### Q5: 如何清除错误状态？

**A:** 在控制台执行：
```javascript
localStorage.removeItem('mm_apply_id')
localStorage.removeItem('mm_apply_deadline')
localStorage.removeItem('mm_apply_step')
location.reload()
```

---

## 📞 技术支持

如果以上方法都无法解决，请联系：

- **文档**: 查看 `docs/Wasm_Unreachable错误完整诊断和修复方案.md`
- **GitHub**: 提交 Issue 并附上诊断信息
- **团队**: 联系开发团队

---

## ✅ 修复确认

修复后，你应该看到：

```
✅ 余额检查通过
✅ 参数验证通过
✅ 交易签名成功
✅ 交易已打包进区块
✅ 资料提交成功！

mmId: 0
状态: 待委员会审核
```

---

**版本**: v1.1.0  
**更新**: 2025-10-14  
**状态**: ✅ 可用

