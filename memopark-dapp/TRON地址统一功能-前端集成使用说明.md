# TRON地址统一功能 - 前端集成使用说明

**集成时间**：2025-10-19  
**版本**：v1.0  
**状态**：✅ 前端集成完成

---

## 📋 功能概述

### 统一TRON地址管理
做市商现在只需要配置一个TRON地址，用于所有USDT业务：
- **OTC订单**：买家向此地址转账USDT购买MEMO
- **Bridge订单**：做市商从此地址向买家发送USDT

---

## ✅ 已完成的前端集成

### 1. 做市商申请页面（CreateMarketMakerPage.tsx）✅

**位置**：`/home/xiaodong/文档/memopark/memopark-dapp/src/features/otc/CreateMarketMakerPage.tsx`

**新增功能**：
- ✅ 添加TRON地址输入框
- ✅ 实时格式验证（34字符，'T'开头，Base58编码）
- ✅ 详细的用途说明和示例
- ✅ 集成到submitInfo调用中

**使用流程**：
1. 做市商质押保证金后（步骤1）
2. 在提交资料步骤（步骤2）中填写TRON地址
3. 系统自动验证地址格式
4. 提交时将TRON地址发送到链上

**UI效果**：
```
🔐 TRON地址配置
━━━━━━━━━━━━━━━━━━━

📌 统一TRON地址说明
• 用途：此TRON地址将用于所有USDT业务
• OTC订单：买家向此地址转账USDT购买MEMO
• Bridge订单：您从此地址向买家发送USDT
• 格式要求：34字符，以'T'开头的TRON主网地址
• 示例：TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS
• 安全提示：请确保地址准确，避免资金损失

TRON地址 *
[TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS            ]
您的TRON主网地址（OTC收款 + Bridge发款），34字符，以'T'开头
```

**验证规则**：
- ✅ 必填字段
- ✅ 必须为34字符
- ✅ 必须以'T'开头（TRON主网）
- ✅ 必须符合Base58编码（排除0、O、I、l）

---

### 2. 做市商配置管理页面（MakerBridgeConfigPage.tsx）✅

**位置**：`/home/xiaodong/文档/memopark/memopark-dapp/src/features/otc/MakerBridgeConfigPage.tsx`

**新增功能**：
- ✅ 显示当前TRON地址
- ✅ 支持更新TRON地址
- ✅ 实时格式验证
- ✅ 集成到updateMakerInfo调用中

**使用流程**：
1. 做市商登录后访问配置管理页面
2. 在"业务配置管理"标签页查看当前TRON地址
3. 输入新的TRON地址（留空则不修改）
4. 点击"更新业务配置"按钮
5. 系统签名并提交更新

**UI效果**：
```
业务配置管理
━━━━━━━━━━━━━━━━━━━

Buy溢价（Bridge，bps）
[     -200      ]
当前值：-200 bps = -2.00%（留空则不修改）

Sell溢价（OTC，bps）
[     +200      ]
当前值：+200 bps = +2.00%（留空则不修改）

TRON地址
[TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS            ]
当前值：TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS
（OTC收款 + Bridge发款，留空则不修改）

最小下单额（MEMO）
[     100.00      ]
当前值：100.00 MEMO（留空则不修改）

[更新业务配置]
```

**验证规则**：
- ✅ 可选字段（留空则不修改）
- ✅ 如果填写，必须为34字符
- ✅ 如果填写，必须以'T'开头
- ✅ 如果填写，必须符合Base58编码

---

### 3. 订单自动集成 ✅

**OTC订单显示**：
- Order结构已包含`maker_tron_address`字段
- 前端查询订单时自动获取做市商TRON地址
- 买家可在订单详情中看到收款地址
- **无需额外前端修改**（链端已实现）

**Bridge订单显示**：
- OcwMakerSwapRecord结构已包含`maker_tron_address`字段
- 前端查询订单时自动获取做市商TRON地址
- **无需额外前端修改**（链端已实现）

---

## 🎯 核心修改点

### 1. CreateMarketMakerPage.tsx

**新增代码位置**：第1818-1872行

**关键代码片段**：
```typescript
// 验证TRON地址
const tron_address = values.tron_address?.trim() || ''
if (!tron_address || tron_address.length !== 34 || !tron_address.startsWith('T')) {
  throw new Error('TRON地址格式无效（必须34字符，以T开头）')
}

// 格式化参数
const tronAddressBytes = Array.from(new TextEncoder().encode(tron_address))

// 签名并发送交易
const hash = await signAndSendLocalFromKeystore('marketMaker', 'submitInfo', [
  mmId,
  publicCid,
  privateCid,
  fee,
  buyPremium,
  sellPremium,
  minAmountFormatted,
  tronAddressBytes,  // 🆕 TRON地址
  epayGatewayBytes,
  Number(epay_port),
  epayPidBytes,
  epayKeyBytes,
  poolFormatted
])
```

---

### 2. MakerBridgeConfigPage.tsx

**新增代码位置**：
- 接口定义：第28行
- 数据解析：第146行
- 表单初始化：第159行
- 参数处理：第418-430行
- 更新调用：第487-496行
- UI输入框：第1018-1049行

**关键代码片段**：
```typescript
// 接口定义
interface MarketMakerInfo {
  // ... 其他字段
  tronAddress: string  // 🆕 2025-10-19：统一TRON地址
}

// 数据解析
const info: MarketMakerInfo = {
  // ... 其他字段
  tronAddress: bytesToString(foundApp.tronAddress),  // 🆕 解析TRON地址
}

// 参数处理
let tronAddressParam = null
if (values.tron_address && values.tron_address.trim() !== '' && values.tron_address.trim() !== marketMakerInfo.tronAddress) {
  const tronAddr = values.tron_address.trim()
  if (tronAddr.length !== 34 || !tronAddr.startsWith('T')) {
    message.error('TRON地址格式无效（必须34字符，以T开头）')
    return
  }
  tronAddressParam = Array.from(new TextEncoder().encode(tronAddr))
}

// 更新调用
const hash = await signAndSendLocalFromKeystore('marketMaker', 'updateMakerInfo', [
  marketMakerInfo.mmId,
  publicCidParam,
  privateCidParam,
  feeBpsParam,
  buyPremiumBpsParam,
  sellPremiumBpsParam,
  minAmountParam,
  tronAddressParam  // 🆕 TRON地址
])
```

---

## 📝 使用说明

### 做市商首次申请流程

1. **访问做市商申请页面**
   - 路由：`/#/market-maker/create`

2. **步骤1：质押保证金**
   - 选择业务方向（Buy/Sell/BuyAndSell）
   - 输入质押金额（最少10,000 MEMO）
   - 点击"质押并生成 mmId"

3. **步骤2：提交资料**
   - 上传公开资料IPFS CID
   - 上传私密资料IPFS CID
   - 设置OTC费率
   - **🆕 设置Buy溢价**（-500 ~ 500 bps）
   - **🆕 设置Sell溢价**（-500 ~ 500 bps）
   - 设置最小下单额
   - **🆕 输入TRON地址**（34字符，以'T'开头）
   - 配置Epay支付网关信息
   - 设置首购资金池
   - 点击"提交资料并等待审核"

4. **等待审核**
   - 治理委员会审核
   - 审核通过后激活

---

### 做市商更新TRON地址流程

1. **访问配置管理页面**
   - 路由：`/#/market-maker/bridge-config`

2. **查看当前配置**
   - 在"业务配置管理"标签页
   - 查看当前TRON地址

3. **更新TRON地址**
   - 在"TRON地址"输入框中输入新地址
   - 或留空表示不修改
   - 其他字段也可以同时更新

4. **提交更新**
   - 点击"更新业务配置"
   - 输入钱包密码签名
   - 等待交易确认

---

## ⚠️ 重要提示

### 1. TRON地址格式
- **必须为主网地址**：以'T'开头（不支持测试网地址）
- **长度固定**：34字符
- **Base58编码**：排除易混淆字符（0、O、I、l）
- **示例有效地址**：
  - `TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS`
  - `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`（USDT合约地址）

### 2. 安全建议
- ✅ 务必核对TRON地址准确性
- ✅ 建议先小额测试
- ✅ 保存好地址备份
- ⚠️ 地址错误可能导致资金损失

### 3. 业务影响
- **OTC订单**：买家将向您的TRON地址转账USDT
- **Bridge订单**：您需要从此TRON地址向买家发送USDT
- **统一管理**：一个地址用于所有USDT业务，简化管理

### 4. 更新时机
- ✅ 首次申请时必须设置
- ✅ 激活后可随时更新
- ✅ 建议在无进行中订单时更新
- ⚠️ 更新后立即生效（新订单使用新地址）

---

## 🔧 技术细节

### 1. 数据流

```
前端输入
  ↓
格式验证（34字符，'T'开头，Base58）
  ↓
转换为字节数组（UTF-8编码）
  ↓
发送到链上（submitInfo / updateMakerInfo）
  ↓
链端验证（is_valid_tron_address）
  ↓
存储到Application.tron_address
  ↓
创建订单时复制到Order.maker_tron_address
  ↓
前端查询订单时自动获取
```

### 2. 链端extrinsic签名

**submitInfo调用**（新做市商）：
```javascript
signAndSendLocalFromKeystore('marketMaker', 'submitInfo', [
  mmId,                 // u64
  publicCid,            // Vec<u8>
  privateCid,           // Vec<u8>
  fee,                  // u16
  buyPremium,           // i16
  sellPremium,          // i16
  minAmount,            // u128
  tronAddressBytes,     // Vec<u8>  🆕 2025-10-19
  epayGatewayBytes,     // Vec<u8>
  epayPort,             // u16
  epayPidBytes,         // Vec<u8>
  epayKeyBytes,         // Vec<u8>
  poolFormatted         // u128
])
```

**updateMakerInfo调用**（激活做市商）：
```javascript
signAndSendLocalFromKeystore('marketMaker', 'updateMakerInfo', [
  mmId,                 // u64
  publicCidParam,       // Option<Vec<u8>>
  privateCidParam,      // Option<Vec<u8>>
  feeBpsParam,          // Option<u16>
  buyPremiumBpsParam,   // Option<i16>
  sellPremiumBpsParam,  // Option<i16>
  minAmountParam,       // Option<u128>
  tronAddressParam      // Option<Vec<u8>>  🆕 2025-10-19
])
```

### 3. 验证逻辑

**前端验证**（实时反馈）：
```typescript
{
  validator: (_, value) => {
    if (!value || value.trim() === '') {
      return Promise.reject(new Error('TRON地址不能为空'))
    }
    if (value.trim().length !== 34) {
      return Promise.reject(new Error('TRON地址必须为34字符'))
    }
    if (!value.trim().startsWith('T')) {
      return Promise.reject(new Error('TRON主网地址必须以T开头'))
    }
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{34}$/
    if (!base58Regex.test(value.trim())) {
      return Promise.reject(new Error('TRON地址包含非法字符（Base58编码：排除0OIl）'))
    }
    return Promise.resolve()
  }
}
```

**链端验证**（最终验证）：
```rust
pub fn is_valid_tron_address(address: &[u8]) -> bool {
    // 1. 检查长度
    if address.len() != 34 { return false; }
    
    // 2. 检查首字符
    if address[0] != b'T' { return false; }
    
    // 3. 检查Base58字符集
    for &byte in address.iter() {
        let is_valid_base58 = match byte {
            b'1'..=b'9' => true,
            b'A'..=b'H' => true,  // 排除I
            b'J'..=b'N' => true,  // 排除O
            b'P'..=b'Z' => true,
            b'a'..=b'k' => true,  // 排除l
            b'm'..=b'z' => true,
            _ => false,
        };
        if !is_valid_base58 { return false; }
    }
    
    true
}
```

---

## 📊 测试建议

### 1. 功能测试

**做市商申请流程测试**：
1. 访问做市商申请页面
2. 完成步骤1（质押保证金）
3. 在步骤2中输入有效的TRON地址
4. 提交资料
5. 验证交易成功

**TRON地址更新测试**：
1. 以做市商身份登录
2. 访问配置管理页面
3. 更新TRON地址
4. 验证更新成功

**格式验证测试**：
- ✅ 输入33字符地址（应报错）
- ✅ 输入35字符地址（应报错）
- ✅ 输入以'A'开头的地址（应报错）
- ✅ 输入包含'0'的地址（应报错）
- ✅ 输入有效地址（应通过）

### 2. 集成测试

**订单创建后检查**：
1. 做市商设置TRON地址
2. 创建OTC或Bridge订单
3. 查询订单详情
4. 验证`maker_tron_address`字段正确

**地址更新后检查**：
1. 做市商更新TRON地址
2. 创建新订单
3. 验证新订单使用新地址
4. 验证旧订单仍使用旧地址

---

## 🎉 完成状态

- ✅ CreateMarketMakerPage.tsx：TRON地址输入（第1818-1872行）
- ✅ CreateMarketMakerPage.tsx：submitInfo调用集成（第764-778行）
- ✅ MakerBridgeConfigPage.tsx：接口定义（第28行）
- ✅ MakerBridgeConfigPage.tsx：数据解析（第146行）
- ✅ MakerBridgeConfigPage.tsx：表单初始化（第159行）
- ✅ MakerBridgeConfigPage.tsx：参数处理（第418-430行）
- ✅ MakerBridgeConfigPage.tsx：更新调用（第487-496行）
- ✅ MakerBridgeConfigPage.tsx：UI输入框（第1018-1049行）
- ✅ 订单自动集成（链端实现）

**前端集成完成度**：100%

---

**文档生成时间**：2025-10-19  
**最后更新**：2025-10-19  
**作者**：AI Assistant

