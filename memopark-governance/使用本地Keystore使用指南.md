# 治理平台使用本地 Keystore 指南

## ✅ 改造已完成

治理平台已成功改造为使用本地 keystore，不再依赖浏览器扩展。

---

## 📋 改造内容

### 1. 新增文件

✅ **`src/lib/keystore.ts`**
- 从 `memopark-dapp` 复制
- 提供加密/解密/存储 keystore 功能

✅ **`src/lib/polkadot.ts`**
- API 连接管理
- 本地 keyring 签名服务
- 余额查询和格式化

✅ **`src/components/WalletConnect/index.tsx`**
- 钱包连接 UI 组件
- 显示账户和余额
- 支持切换账户

### 2. 修改文件

✅ **`src/contexts/Wallet/index.tsx`**
- 从浏览器扩展改为本地 keystore
- 支持跨标签页同步
- 自动加载账户和余额

✅ **`src/services/wallet/signer.ts`**
- 从 `web3FromAddress` 改为本地 keyring
- 使用 Modal 请求密码输入
- 等待交易最终确认

✅ **`package.json`**
- 移除 `@polkadot/extension-dapp`
- 添加 `@polkadot/keyring`

### 3. 备份文件

⚠️ **原文件已备份：**
- `src/contexts/Wallet/index.tsx.backup`
- `src/services/wallet/signer.ts.backup`

---

## 🚀 使用步骤

### 第 1 步：在用户端创建钱包

**URL:** http://localhost:5173/#/wallet/create

**操作：**
1. 输入密码（至少 8 位）
2. 记录助记词（12 个单词）
3. 确认创建
4. 验证创建成功

**验证：**
```javascript
// 在浏览器控制台运行
console.log(localStorage.getItem('mp.keystore'))
console.log(localStorage.getItem('mp.current'))
// 应该看到加密的 keystore 数据和当前地址
```

---

### 第 2 步：启动治理平台

```bash
cd /home/xiaodong/文档/memopark/memopark-governance
npm run dev
```

**打开：** http://localhost:3000/

**预期显示：**
- ✅ 自动加载当前账户
- ✅ 显示账户地址
- ✅ 显示可用余额
- ✅ 显示"已连接"状态

---

### 第 3 步：测试签名功能

**测试场景：创建提案**

**URL:** http://localhost:3000/proposals/create

**操作：**
1. 选择提案类型（批准/驳回）
2. 填写申请编号（如：0）
3. 填写投票阈值（如：2）
4. 点击"提交提案"
5. **弹出密码输入框**
6. 输入钱包密码
7. 点击"确认签名"

**预期结果：**
- ✅ 显示"正在签名并发送交易..."
- ✅ 交易成功提交
- ✅ 显示"交易已提交！"
- ✅ 跳转到提案列表

**控制台日志示例：**
```
[签名] 开始签名交易...
[API] 连接成功
[交易状态] Ready
[交易状态] InBlock
✓ 交易已打包进区块: 0xabcd...
[交易状态] Finalized
✓ 交易已最终确认: 0xabcd...
```

---

## 🎨 UI 组件使用

### WalletConnect 组件

**用法：**
```typescript
import { WalletConnect } from '@/components/WalletConnect'

function MyPage() {
  return (
    <div>
      <WalletConnect />
      {/* 其他内容 */}
    </div>
  )
}
```

**显示内容：**
- 未连接时：提示用户前往创建钱包
- 已连接时：显示账户地址、余额、切换账户按钮

---

## 🔧 常见问题

### Q1: 显示"未检测到本地钱包"

**原因：** localStorage 中没有 `mp.keystore`

**解决方案：**
1. 前往用户端创建钱包：http://localhost:5173/#/wallet/create
2. 创建后刷新治理平台页面
3. 如果仍然显示未连接，检查是否使用相同的域名/端口

**验证：**
```javascript
// 在浏览器控制台运行
console.log(localStorage.getItem('mp.keystore'))
// 应该不是 null
```

---

### Q2: 密码输入框没有弹出

**原因：** Modal 组件可能被其他 CSS 遮挡

**解决方案：**
1. 检查浏览器控制台是否有错误
2. 检查是否安装了所有依赖：`npm install`
3. 重启开发服务器：`npm run dev`

---

### Q3: 签名失败："地址不匹配"

**原因：** 当前选中的账户与 keystore 中的账户不一致

**解决方案：**
1. 检查当前账户：`localStorage.getItem('mp.current')`
2. 检查 keystore 地址：`JSON.parse(localStorage.getItem('mp.keystore')).address`
3. 如果不一致，在用户端切换账户

---

### Q4: 提交提案失败："wasm unreachable"

**原因：** 这是链端错误，与钱包无关

**可能原因：**
1. 申请不存在或状态不对
2. 当前账户不是理事会成员
3. 参数类型错误

**解决方案：**
参考：`/home/xiaodong/文档/memopark/docs/治理平台Wasm_Unreachable完整诊断.md`

---

### Q5: 跨标签页账户不同步

**原因：** localStorage 的 storage 事件监听可能失效

**解决方案：**
1. 手动刷新页面（F5）
2. 检查浏览器控制台是否有错误
3. 确认两个标签页使用相同的域名和端口

---

## 🔐 安全注意事项

### 1. 密码安全

- ✅ 密码不会存储在 localStorage
- ✅ 密码仅在签名时临时使用
- ⚠️ 每次签名都需要输入密码（更安全）

### 2. Keystore 安全

- ✅ 助记词使用 PBKDF2 (210,000 次迭代) + AES-GCM 加密
- ⚠️ localStorage 有 XSS 风险
- 📋 建议：开发测试环境使用，主网谨慎使用

### 3. 账户管理

- ✅ 支持多账户管理
- ✅ 可以随时切换账户
- ✅ 账户数据与用户端共享

---

## 📊 与用户端的区别

| 项目 | 用户端 (memopark-dapp) | 治理平台 (memopark-governance) |
|------|----------------------|------------------------------|
| **keystore 来源** | 创建或导入 | 读取用户端的 keystore |
| **密码输入** | window.prompt | Ant Design Modal |
| **UI 风格** | 简洁实用 | 专业治理 |
| **主要功能** | OTC 交易、做市商申请 | 提案投票、审批 |
| **账户管理** | 创建、导入、导出 | 仅读取和切换 |

---

## 🎯 后续优化建议

### P1 优先级（重要）

1. **密码缓存功能**
   - 实现"记住密码 X 分钟"
   - 避免频繁输入密码
   - 提升用户体验

2. **错误提示优化**
   - 更友好的错误信息
   - 添加错误码和解决方案链接

3. **交易历史记录**
   - 记录所有签名的交易
   - 显示交易状态和区块哈希

### P2 优先级（可选）

1. **账户管理 UI**
   - 在治理平台内创建新账户
   - 导入/导出账户

2. **余额实时更新**
   - WebSocket 监听余额变化
   - 自动刷新余额

3. **多签支持**
   - 支持多签账户
   - 显示多签阈值和签名进度

---

## 📞 技术支持

如有问题，请检查：

1. **浏览器控制台日志**
   - 查看错误信息
   - 查看签名流程日志

2. **localStorage 内容**
   ```javascript
   console.log('keystore:', localStorage.getItem('mp.keystore'))
   console.log('current:', localStorage.getItem('mp.current'))
   console.log('accounts:', localStorage.getItem('mp.accounts'))
   ```

3. **链端日志**
   ```bash
   tail -100 /home/xiaodong/文档/memopark/node.log
   ```

4. **参考文档**
   - `/home/xiaodong/文档/memopark/docs/治理平台改造方案-使用本地Keystore.md`
   - `/home/xiaodong/文档/memopark/docs/治理平台Wasm_Unreachable完整诊断.md`

---

## ✅ 验收清单

完成以下检查即表示改造成功：

- [ ] 用户端创建钱包成功
- [ ] 治理平台显示"已连接"状态
- [ ] 显示正确的账户地址
- [ ] 显示正确的余额
- [ ] 点击"提交提案"弹出密码输入框
- [ ] 输入密码后交易成功提交
- [ ] 控制台无浏览器扩展相关错误
- [ ] 跨标签页账户同步正常
- [ ] 切换账户功能正常（如果有多个账户）

---

**最后更新：** 2025-10-15
**改造状态：** ✅ 已完成
**测试状态：** 待验证

