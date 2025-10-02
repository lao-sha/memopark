# 做市商申请指南

## 访问路径

```
#/otc/mm-apply
```

## 功能概述

做市商申请采用**两步式流程**，确保申请人有充足时间准备资料，同时保障平台资金安全。

---

## 申请流程

### 步骤 1：质押保证金

#### 操作步骤
1. 访问 `#/otc/mm-apply`
2. 输入质押金额（最低 1000 MEMO）
3. 点击"签名质押"
4. 输入本地钱包密码完成签名
5. 等待链上确认

#### 链上调用
```typescript
api.tx.marketMaker.lockDeposit(amount)
```

#### 效果
- 锁定质押金额（使用 `reserve` 机制）
- 生成 `mm_id`（申请编号）
- 设置 24 小时资料提交窗口
- 状态变更为 `DepositLocked`

#### 注意事项
- ⚠️ 质押金额将被锁定，直到申请被批准或驳回
- ⚠️ 24 小时内必须提交资料，否则可能被扣除手续费
- ✅ 质押成功后，页面会显示 `mm_id` 和截止时间

---

### 步骤 2：提交资料

#### 准备资料

##### 1. 公开资料（public_root_cid）
创建一个 IPFS 目录，包含以下文件：

```
public/
├── mm.json          # 做市商基本信息
├── logo.png         # Logo 图标（推荐 256x256）
├── banner.png       # 横幅图（推荐 1200x400）
├── fee.json         # 费率说明
└── pairs.json       # 支持的交易对列表
```

**mm.json 示例**：
```json
{
  "name": "示例做市商",
  "description": "专业的数字资产做市服务",
  "website": "https://example.com",
  "contact": "support@example.com",
  "established": "2024-01-01",
  "social": {
    "twitter": "https://twitter.com/example",
    "telegram": "https://t.me/example"
  }
}
```

**fee.json 示例**：
```json
{
  "fee_bps": 25,
  "fee_percentage": "0.25%",
  "description": "每笔交易收取 0.25% 手续费",
  "min_amount": "100.00 MEMO",
  "max_amount": "1000000.00 MEMO"
}
```

**上传到 IPFS**：
```bash
ipfs add -r public/
# 获取根目录的 CID，例如：
# bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi
```

##### 2. 私密资料（private_root_cid）
创建私密文件并加密：

```
private/
├── manifest.json    # 文件清单（明文）
├── license.enc      # 营业执照（加密）
├── identity.enc     # 身份证明（加密）
├── proof.enc        # 资金证明（加密）
└── contact.enc      # 详细联系方式（加密）
```

**加密流程**：
```bash
# 1. 生成加密密钥（使用委员会公钥）
# 2. 加密文件
openssl enc -aes-256-cbc -salt -in license.pdf -out license.enc -k <password>

# 3. 创建 manifest.json
{
  "files": [
    {
      "name": "license.enc",
      "original": "license.pdf",
      "sha256": "...",
      "encrypted": true,
      "description": "营业执照"
    },
    {
      "name": "identity.enc",
      "original": "identity.pdf",
      "sha256": "...",
      "encrypted": true,
      "description": "身份证明文件"
    }
  ],
  "encryption": {
    "algorithm": "AES-256-CBC",
    "note": "使用委员会公钥加密"
  }
}

# 4. 上传到 IPFS
ipfs add -r private/
```

**重要规则**：
- ✅ CID 一律不加密（明文 IPFS CID）
- ✅ 文件内容加密，CID 指向密文文件
- ✅ 禁止使用 `enc:` 前缀
- ✅ 支持 CIDv0（Qm...）和 CIDv1（bafy...）

#### 填写表单

1. **公开资料根 CID**
   - 粘贴上传后的公开目录 CID
   - 格式：`bafy...` 或 `Qm...`
   - 长度：46+ 字符

2. **私密资料根 CID**
   - 粘贴上传后的私密目录 CID
   - 格式：`bafy...` 或 `Qm...`
   - 长度：46+ 字符

3. **费率（bps）**
   - 范围：0-10000 bps
   - 示例：25 bps = 0.25%
   - 说明：1 bps = 0.01%

4. **最小下单额（MEMO）**
   - 最小值：0.01 MEMO
   - 示例：100.00 MEMO
   - 说明：用户单笔交易的最小金额限制

#### 提交操作

1. 填写完整表单
2. 点击"提交资料"
3. 输入本地钱包密码完成签名
4. 等待链上确认

#### 链上调用
```typescript
api.tx.marketMaker.submitInfo(
  mm_id,
  public_root_cid,
  private_root_cid,
  fee_bps,
  min_amount
)
```

#### 效果
- 状态变更为 `PendingReview`
- 进入委员会审核队列
- 发出 `Submitted` 事件

---

## 审核流程

### 委员会审核

1. **访问审核页面**
   - 路径：`#/gov/mm-review`
   - 权限：委员会成员

2. **审查资料**
   - 下载公开资料（IPFS 网关）
   - 下载私密资料（加密文件）
   - 离线解密并验证
   - 核对文件哈希与 manifest

3. **审批决策**
   - **批准**：`api.tx.marketMaker.approve(mm_id)`
     - 状态变更为 `Active`
     - 押金转为长期保证金
     - 做市商可以开始接单
   - **驳回**：`api.tx.marketMaker.reject(mm_id, slash_bps)`
     - 状态变更为 `Rejected`
     - 按比例扣罚押金（0-100%）
     - 余额退还申请人

### 审核标准

✅ **通过条件**：
- 公开资料完整且真实
- 私密资料齐全可验证
- 营业执照/身份证明有效
- 资金证明充足
- 费率合理
- 无欺诈记录

❌ **驳回原因**：
- 资料虚假或伪造
- 身份信息不符
- 资金证明不足
- 费率过高或不合理
- 有欺诈/违规记录
- 资料不完整

---

## 状态流转

```
                    ┌──────────────┐
                    │  未申请       │
                    └──────┬───────┘
                           │
                    lock_deposit
                           │
                    ┌──────▼───────┐
                    │ DepositLocked │ (24h 窗口)
                    └──────┬───────┘
                           │
                    submit_info
                           │
                    ┌──────▼───────┐
           ┌────────┤ PendingReview├────────┐
           │        └──────────────┘        │
           │                                │
        approve                          reject
           │                                │
    ┌──────▼───────┐              ┌────────▼────────┐
    │    Active    │              │    Rejected     │
    │  (可接单)     │              │  (扣罚+退款)    │
    └──────────────┘              └─────────────────┘
```

---

## 常见问题

### Q1: 质押金额会被退还吗？
**A**: 
- ✅ 申请通过：押金转为长期保证金（可提现但需保持最低余额）
- ❌ 申请驳回：按比例扣罚后退还余额
- ⏱️ 超时未提交：可能扣除手续费后退还

### Q2: 如何准备私密资料？
**A**: 
1. 扫描/拍摄原始文件（PDF/JPG）
2. 使用委员会公钥加密
3. 创建 manifest.json 记录文件清单
4. 上传到 IPFS 获取 CID
5. 将明文 CID 填入表单

### Q3: CID 格式要求是什么？
**A**:
- ✅ 支持 CIDv0：`Qm...`（Base58btc，44+ 字符）
- ✅ 支持 CIDv1：`bafy...`（Base32，46+ 字符）
- ❌ 禁止：`enc:...`（加密前缀）
- ❌ 禁止：非法字符或长度不足

### Q4: 提交资料后多久能得到审核结果？
**A**:
- 通常 3-7 个工作日
- 复杂案例可能延长至 14 天
- 可在"我的申请"中查看进度

### Q5: 申请被驳回后可以重新申请吗？
**A**:
- ✅ 可以重新申请
- ⚠️ 需要重新质押
- 💡 建议修正驳回原因后再申请

---

## 技术规格

### 链上存储

```rust
pub struct Application {
    pub owner: AccountId,          // 申请人
    pub deposit: Balance,          // 质押金额
    pub status: ApplicationStatus, // 状态
    pub public_cid: Cid,          // 公开资料 CID
    pub private_cid: Cid,         // 私密资料 CID
    pub fee_bps: u16,             // 费率（bps）
    pub min_amount: Balance,      // 最小下单额
    pub created_at: u32,          // 质押时间（秒）
    pub info_deadline: u32,       // 资料截止时间
    pub review_deadline: u32,     // 审核截止时间
}
```

### 事件

| 事件名 | 参数 | 说明 |
|--------|------|------|
| `Applied` | `mm_id, owner, deposit` | 质押成功 |
| `Submitted` | `mm_id` | 资料提交成功 |
| `Approved` | `mm_id` | 申请批准 |
| `Rejected` | `mm_id, slash` | 申请驳回 |
| `Cancelled` | `mm_id` | 申请取消 |
| `Expired` | `mm_id` | 申请过期 |

### 错误码

| 错误名 | 说明 |
|--------|------|
| `AlreadyMember` | 已是做市商 |
| `NotFound` | 申请不存在 |
| `NotDepositLocked` | 状态不是 DepositLocked |
| `NotPendingReview` | 状态不是 PendingReview |
| `AlreadyFinalized` | 申请已终结 |
| `DeadlinePassed` | 超过截止时间 |
| `InvalidFee` | 费率超出范围 |
| `BadSlashRatio` | 扣罚比例超出限制 |
| `MinDepositNotMet` | 押金低于最小值 |

---

## 开发者注意事项

### 前端集成

```typescript
// 1. 质押
const depositAmount = formatMemoAmount(1000) // 1000 MEMO
const hash = await signAndSendLocalFromKeystore(
  'marketMaker', 
  'lockDeposit', 
  [depositAmount]
)

// 2. 提交资料
const publicCid = Array.from(new TextEncoder().encode('bafy...'))
const privateCid = Array.from(new TextEncoder().encode('bafy...'))
const hash = await signAndSendLocalFromKeystore(
  'marketMaker', 
  'submitInfo', 
  [mmId, publicCid, privateCid, feeBps, minAmount]
)
```

### 余额格式

MEMO 使用 **12 位小数**：
```typescript
1 MEMO = 1,000,000,000,000 (1e12)
0.001 MEMO = 1,000,000,000 (1e9)
```

### CID 编码

```typescript
// 字符串 → Uint8Array
const cidBytes = Array.from(new TextEncoder().encode(cidString))

// Uint8Array → 字符串
const cidString = new TextDecoder().decode(new Uint8Array(cidBytes))
```

---

## 安全建议

1. ✅ **本地签名**：使用本地 keystore，不依赖浏览器扩展
2. ✅ **资料加密**：私密文件使用委员会公钥加密
3. ✅ **CID 验证**：提交前验证 CID 可访问
4. ✅ **备份资料**：保留原始文件和加密密钥
5. ⚠️ **防止泄露**：不要在公开渠道分享私密 CID 的解密密钥

---

## 联系支持

如有疑问，请联系：
- 📧 Email: support@memopark.com
- 💬 Telegram: @memopark_support
- 📖 文档: https://docs.memopark.com

---

## 更新日志

### v1.0.0 (2025-09-30)
- ✨ 初始版本
- ✨ 实现两步式申请流程
- ✨ 集成链上调用
- ✨ 完整的表单验证
- ✨ 友好的用户体验
