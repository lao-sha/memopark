# DAPP 治理功能迁移指南

> 本指南帮助用户从 memopark-dapp 迁移到 memopark-governance 使用治理功能

## 📱 → 🖥️ 功能迁移对照表

### 1. 内容治理相关

| 原DAPP功能 | 新Web平台功能 | 迁移难度 | 说明 |
|-----------|--------------|---------|------|
| `#/gov/appeal`<br/>提交申诉 | `https://governance/content-governance`<br/>点击"提交申诉"按钮 | ⭐ 易 | DAPP保留简化版 |
| `#/gov/review`<br/>审查台 | `https://governance/content-governance`<br/>待审批/已批准标签页 | ⭐⭐ 中 | Web版功能更强 |
| `#/gov/templates`<br/>审批模板 | 已整合到各功能页面的表单中 | ⭐⭐⭐ 难 | 无需单独页面 |

**迁移步骤**：

**提交申诉**（保留在DAPP）：
1. 在DAPP中：`#/gov/appeal`
2. 填写 domain、action、target、证据CID
3. 提交后会显示申诉ID
4. 点击"查看进度"自动跳转到 Web 平台

**审批申诉**（迁移到Web）：
1. 访问 `https://governance.memopark.com/content-governance`
2. 登录钱包（与DAPP相同的地址）
3. 查看待审批列表
4. 单个或批量批准/驳回
5. 查看已批准/已驳回历史

---

### 2. 委员会提案相关

| 原DAPP功能 | 新Web平台功能 | 迁移难度 | 说明 |
|-----------|--------------|---------|------|
| `#/gov/council-proposals`<br/>委员会提案 | `https://governance/committees`<br/>选择对应委员会查看提案 | ⭐⭐ 中 | Web版支持3个委员会 |
| 提交提案 | `https://governance/proposals/create` | ⭐⭐ 中 | 参数更清晰 |
| 投票 | `https://governance/committees` | ⭐ 易 | 进度条可视化 |
| 执行提案 | `https://governance/committees` | ⭐ 易 | 自动检测可执行 |
| 我的投票 | `https://governance/voting` | ⭐ 易 | 统计更详细 |

**迁移步骤**：

**提交委员会提案**：
1. 访问 `https://governance.memopark.com/proposals/create`
2. 选择提案类型（批准/驳回做市商）
3. 选择待审申请
4. 设置投票阈值（推荐：2，即2/3多数）
5. 提交并复制提案哈希分享给其他成员

**投票**：
1. 访问 `https://governance.memopark.com/committees`
2. 切换到对应委员会（Council/Technical/Content）
3. 查看提案列表（自动显示进度）
4. 点击"赞成"或"反对"
5. 确认并签名

**执行提案**：
1. 在提案列表中找到已达阈值的提案
2. 提案卡片会显示"可执行"标签
3. 点击"执行提案"按钮
4. 确认并签名
5. 等待交易确认

---

### 3. 做市商审批相关

| 原DAPP功能 | 新Web平台功能 | 迁移难度 | 说明 |
|-----------|--------------|---------|------|
| `#/gov/mm-review`<br/>做市商审核 | `https://governance/applications` | ⭐ 易 | Web版UI更专业 |
| 查看待审申请 | 待审核标签页 | ⭐ 易 | 支持筛选和排序 |
| 查看已批准 | 已审核标签页 | ⭐ 易 | 历史记录完整 |
| 查看CID详情 | 点击"复制CID"/"在IPFS查看" | ⭐ 易 | 一键复制和查看 |
| 创建审批提案 | 点击"创建提案"按钮 | ⭐ 易 | 自动填充参数 |

**迁移步骤**：

**审核做市商**：
1. 访问 `https://governance.memopark.com/applications`
2. 默认显示"待审核"视图
3. 点击申请查看详情（公开CID、私密CID、费率等）
4. 点击"复制CID"并在IPFS网关查看资料
5. 离线解密私密资料并验证
6. 点击"创建提案"→ 选择"批准"或"驳回"
7. 提交提案并通知其他委员会成员投票

**查看已批准做市商**：
1. 点击"已审核"标签页
2. 查看所有Active状态的做市商
3. 查看详情和资料

---

### 4. 仲裁管理相关

| 原DAPP功能 | 新Web平台功能 | 迁移难度 | 说明 |
|-----------|--------------|---------|------|
| `#/admin/arbitration`<br/>仲裁管理 | `https://governance/arbitration` | ⭐⭐ 中 | Web版功能更完整 |
| 查看争议列表 | 所有案件/待处理/已解决 | ⭐ 易 | 筛选更方便 |
| 执行裁决 | 选择裁决类型并提交 | ⭐ 易 | UI更清晰 |
| 追加证据 | 案件详情页操作 | ⭐⭐ 中 | 权限检查更严格 |

**迁移步骤**：

**查看争议案件**：
1. 访问 `https://governance.memopark.com/arbitration`
2. 默认显示所有案件
3. 使用筛选器选择"待处理"或"已解决"
4. 点击案件查看详情

**执行裁决**：
1. 点击案件卡片
2. 查看详情（买家、卖家、金额、证据ID）
3. 选择裁决类型：
   - 全额退款（买家胜诉）
   - 全额支付（卖家胜诉）
   - 部分退款（输入比例）
4. 确认并签名
5. 等待交易确认

---

### 5. 墓地/陵园治理相关

| 原DAPP功能 | 新Web平台功能 | 迁移难度 | 说明 |
|-----------|--------------|---------|------|
| `#/grave/gov`<br/>墓位治理工具 | `https://governance/grave-governance` | ⭐ 易 | Web版表单更清晰 |
| `#/park/gov`<br/>园区治理工具 | `https://governance/park-governance` | ⭐ 易 | Web版表单更清晰 |

**迁移步骤**：

**墓地治理**：
1. 访问 `https://governance.memopark.com/grave-governance`
2. 选择操作标签页（转让/限制/删除/恢复）
3. 填写墓地ID和证据CID
4. 根据操作填写额外参数（新所有者、原因代码等）
5. 提交并签名

**陵园治理**：
1. 访问 `https://governance.memopark.com/park-governance`
2. 选择操作标签页（更新/设置管理员/转让/设置封面）
3. 填写陵园ID和证据CID
4. 根据操作填写额外参数
5. 提交并签名

---

### 6. 公投管理相关（Legacy，已废弃）

| 原DAPP功能 | 新Web平台功能 | 迁移难度 | 说明 |
|-----------|--------------|---------|------|
| `#/gov/home`<br/>治理首页 | `https://governance/` | ⭐ 易 | 已删除 |
| `#/gov/list`<br/>公投列表 | `https://governance/referenda` | ⭐ 易 | 已删除 |
| `#/gov/detail`<br/>公投详情 | `https://governance/referenda/:id` | ⭐ 易 | 已删除 |
| `#/gov/new`<br/>发起提案 | 当前主流程为委员会提案 | ⚠️ 已废弃 | 已删除 |

**说明**：
- DAPP中的公投功能已标记为Legacy，不再维护
- 当前主流程为"委员会阈值 + 申诉治理"
- Web平台保留公投查看功能，但不作为主要流程

---

## 🔗 快捷跳转方案

### 方案1：URL参数传递

**从 DAPP 跳转到 Web 平台并预填参数**：

```typescript
// 示例：从墓地详情页跳转到墓地治理
const graveId = 123
const url = `https://governance.memopark.com/grave-governance?id=${graveId}`
window.open(url, '_blank')

// Web平台自动识别参数并预填表单
```

**支持的参数**：

| Web页面 | 支持参数 | 示例 |
|---------|---------|------|
| `/content-governance` | `action=submit&domain=1&target=123` | 提交申诉并预填 |
| `/grave-governance` | `id=123&action=transfer` | 预填墓地ID和操作 |
| `/park-governance` | `id=456&action=update` | 预填陵园ID和操作 |
| `/arbitration` | `caseId=789` | 直接打开案件详情 |
| `/applications` | `mmId=0` | 直接打开申请详情 |

### 方案2：深链接（Deep Link）

**在 DAPP 的关键位置添加跳转按钮**：

```typescript
// 墓地详情页添加"治理操作"按钮
<Button 
  onClick={() => {
    window.open(
      `https://governance.memopark.com/grave-governance?id=${graveId}`,
      '_blank'
    )
  }}
>
  管理员治理操作（Web平台）→
</Button>
```

**建议添加位置**：
1. **墓地详情页**：添加"治理操作"按钮
2. **做市商申请成功页**：添加"查看审核进度"链接
3. **个人中心**：添加"我的治理（Web）"快捷入口
4. **首页**：添加"专业治理平台"卡片

---

## 🎨 UI改造建议

### 改造1：SubmitAppealPage（保留并简化）

**改造前**：
- 完整的表单
- 无跳转提示

**改造后**：
```typescript
<div style={{ maxWidth: 640, margin: '0 auto', padding: 12 }}>
  {/* 顶部提示 */}
  <Alert
    type="info"
    showIcon
    message="移动端快速提交"
    description={
      <div>
        <div>需要查看审批进度、批量操作或专业工具？</div>
        <a 
          href="https://governance.memopark.com/content-governance" 
          target="_blank"
          style={{ fontWeight: 'bold' }}
        >
          前往Web治理平台 →
        </a>
      </div>
    }
    style={{ marginBottom: 12 }}
  />

  {/* 简化的表单（仅核心字段） */}
  <Form onFinish={onSubmit}>
    <Form.Item name="domain" label="域" required>
      <InputNumber min={0} style={{ width: '100%' }} />
    </Form.Item>
    <Form.Item name="target" label="目标ID" required>
      <InputNumber min={0} style={{ width: '100%' }} />
    </Form.Item>
    <Form.Item name="action" label="动作" required>
      <InputNumber min={0} style={{ width: '100%' }} />
    </Form.Item>
    <Form.Item name="evidenceCid" label="证据CID" required>
      <Input placeholder="明文CID，不加密" />
    </Form.Item>
    <Form.Item name="reasonCid" label="理由CID" required>
      <Input placeholder="明文CID，不加密" />
    </Form.Item>
    
    <Button type="primary" htmlType="submit" block>
      提交申诉
    </Button>
  </Form>

  {/* 提交成功后的跳转提示 */}
  {txHash && (
    <Alert
      type="success"
      message="提交成功"
      description={
        <div>
          <div>交易哈希：{txHash}</div>
          <Button 
            type="link" 
            onClick={() => {
              window.open(
                'https://governance.memopark.com/content-governance?tab=pending',
                '_blank'
              )
            }}
          >
            前往Web平台查看进度 →
          </Button>
        </div>
      }
      style={{ marginTop: 12 }}
    />
  )}
</div>
```

---

### 改造2：MyGovernancePage（保留并引导）

**改造前**：
- 完整的投票列表
- 锁仓详情
- 提案历史

**改造后**：
```typescript
<div style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}>
  {/* 顶部引导卡片 */}
  <Card style={{ marginBottom: 16 }}>
    <Alert
      type="success"
      showIcon
      message="专业治理功能已迁移"
      description={
        <div>
          <div style={{ marginBottom: 8 }}>
            完整的治理功能（提案、投票、委员会、仲裁等）已迁移到专业Web平台
          </div>
          <Button 
            type="primary" 
            size="large"
            block
            onClick={() => {
              window.open('https://governance.memopark.com', '_blank')
            }}
          >
            🖥️ 打开Web治理平台
          </Button>
        </div>
      }
    />
  </Card>

  {/* 简化的我的投票摘要 */}
  <Card title="我的投票（摘要）" size="small">
    {loading ? (
      <div>加载中...</div>
    ) : (
      <div>
        <div style={{ fontSize: 24, fontWeight: 'bold' }}>
          {votes.length} 条
        </div>
        <div style={{ color: '#666', marginTop: 4 }}>
          总投票记录
        </div>
        <Button 
          type="link" 
          onClick={() => {
            window.open('https://governance.memopark.com/voting', '_blank')
          }}
        >
          查看详情和管理 →
        </Button>
      </div>
    )}
  </Card>

  {/* 简化的锁仓摘要 */}
  <Card title="我的锁仓（摘要）" size="small" style={{ marginTop: 12 }}>
    <div style={{ fontSize: 24, fontWeight: 'bold' }}>
      {locks.length} 项
    </div>
    <div style={{ color: '#666', marginTop: 4 }}>
      总锁仓记录
    </div>
    <Button 
      type="link" 
      onClick={() => {
        window.open('https://governance.memopark.com/voting', '_blank')
      }}
    >
      管理解锁 →
    </Button>
  </Card>
</div>
```

---

### 改造3：AppealEntry 组件（修改跳转目标）

**改造前**：
```typescript
const onClick = () => {
  window.location.hash = `#/gov/appeal?domain=${domain}&target=${targetId}`
}
```

**改造后**：
```typescript
const onClick = () => {
  // 跳转到Web平台，携带参数
  const url = `https://governance.memopark.com/content-governance?action=submit&domain=${domain}&target=${targetId}&ref=dapp`
  window.open(url, '_blank')
  
  // 或者保留DAPP的简化提交页
  // window.location.hash = `#/gov/appeal?domain=${domain}&target=${targetId}`
}
```

**使用场景保持不变**：
- 在墓地详情旁显示申诉入口
- 在逝者信息旁显示申诉入口
- 在媒体内容旁显示申诉入口

---

## 🏠 添加引导入口

### 1. 首页（HomePage.tsx）

在轮播图下方添加：

```typescript
<Card size="small" title="🏛️ 专业治理" style={{ marginTop: 12 }}>
  <Space direction="vertical" style={{ width: '100%' }}>
    <Alert
      type="info"
      message="委员会成员和管理员专用"
      description="内容审批、做市商审核、仲裁管理、墓地治理等专业功能"
    />
    <Button 
      type="primary" 
      block 
      size="large"
      href="https://governance.memopark.com"
      target="_blank"
    >
      打开Web治理平台 →
    </Button>
    <Space style={{ width: '100%', justifyContent: 'space-around' }}>
      <div style={{ textAlign: 'center', flex: 1 }}>
        <div style={{ fontSize: 20, fontWeight: 'bold' }}>5+</div>
        <div style={{ fontSize: 12, color: '#666' }}>治理模块</div>
      </div>
      <div style={{ textAlign: 'center', flex: 1 }}>
        <div style={{ fontSize: 20, fontWeight: 'bold' }}>3</div>
        <div style={{ fontSize: 12, color: '#666' }}>委员会</div>
      </div>
      <div style={{ textAlign: 'center', flex: 1 }}>
        <div style={{ fontSize: 20, fontWeight: 'bold' }}>95%</div>
        <div style={{ fontSize: 12, color: '#666' }}>功能完成</div>
      </div>
    </Space>
  </Space>
</Card>
```

### 2. 个人中心（ProfilePage.tsx）

在账户信息下方添加：

```typescript
<Card size="small" title="治理与管理" style={{ marginTop: 12 }}>
  <Space direction="vertical" style={{ width: '100%' }} size={8}>
    <Typography.Text type="secondary">
      专业治理功能已迁移到Web平台
    </Typography.Text>
    
    <Button
      block
      type="primary"
      href="https://governance.memopark.com"
      target="_blank"
    >
      🖥️ Web治理平台
    </Button>
    
    <Divider style={{ margin: '8px 0' }} />
    
    <Typography.Text strong>快捷入口：</Typography.Text>
    
    <Button
      block
      size="small"
      onClick={() => {
        window.open('https://governance.memopark.com/content-governance', '_blank')
      }}
    >
      内容治理（审批申诉）
    </Button>
    
    <Button
      block
      size="small"
      onClick={() => {
        window.open('https://governance.memopark.com/applications', '_blank')
      }}
    >
      做市商审批
    </Button>
    
    <Button
      block
      size="small"
      onClick={() => {
        window.open('https://governance.memopark.com/arbitration', '_blank')
      }}
    >
      仲裁管理
    </Button>
    
    <Button
      block
      size="small"
      onClick={() => {
        window.location.hash = '#/gov/appeal'
      }}
    >
      快速提交申诉（移动端）
    </Button>
  </Space>
</Card>
```

---

## 📚 保留功能说明

### 1. SubmitAppealPage（简化保留）

**保留理由**：
- ✅ 移动端快速入口
- ✅ 降低大众参与门槛
- ✅ 无需切换到桌面端

**使用场景**：
- 用户在移动端发现不当内容，快速提交申诉
- 提交后自动跳转到Web查看进度

**功能范围**：
- ✅ 提交申诉表单
- ✅ 显示链上常量（押金、公示期等）
- ❌ 删除审批功能
- ❌ 删除批量操作

---

### 2. MyGovernancePage（引导保留）

**保留理由**：
- ✅ 用户需要快速查看自己的治理摘要
- ✅ 作为跳转到Web平台的引导页

**使用场景**：
- 查看我有多少投票记录
- 查看我有多少锁仓待解锁
- 点击跳转到Web查看详情

**功能范围**：
- ✅ 显示投票数量
- ✅ 显示锁仓数量
- ✅ 跳转到Web平台的按钮
- ❌ 删除详细列表
- ❌ 删除批量解锁
- ❌ 删除CSV导出

---

### 3. AppealEntry 组件（修改保留）

**保留理由**：
- ✅ 在各对象旁提供快捷申诉入口
- ✅ 符合治理UI开关的设计

**使用场景**：
- 在墓地详情页旁显示申诉按钮
- 在逝者信息旁显示申诉按钮
- 点击后跳转到申诉提交页

**修改内容**：
- ✅ 跳转目标可配置（DAPP或Web）
- ✅ 支持参数预填
- ❌ 不改变组件结构

---

## 🧪 测试清单

### 编译测试

```bash
cd memopark-dapp
npm run build
```

**预期**：
- ✅ 无 TypeScript 错误
- ✅ 无 Linter 错误
- ✅ 打包成功
- ✅ 体积减小 25-30%

---

### 功能测试

| 功能 | 测试步骤 | 预期结果 |
|------|---------|---------|
| **创建墓地** | 访问 `#/grave/create`，填写表单提交 | ✅ 成功创建 |
| **供奉** | 访问墓地详情，点击供奉 | ✅ 成功供奉 |
| **提交申诉** | 访问 `#/gov/appeal`，填写并提交 | ✅ 成功提交 |
| **查看我的治理** | 访问 `#/gov/me` | ✅ 显示摘要和跳转按钮 |
| **申诉入口按钮** | 在墓地详情页查看 | ✅ 显示按钮，点击跳转正确 |
| **治理路由** | 访问 `#/gov/council-proposals` | ✅ 返回404或跳转到引导页 |

---

### 跳转测试

| 跳转场景 | 测试步骤 | 预期结果 |
|---------|---------|---------|
| **首页跳转** | 点击"Web治理平台"按钮 | ✅ 打开 governance 首页 |
| **个人中心跳转** | 点击各治理快捷入口 | ✅ 打开对应页面 |
| **申诉跳转** | 提交申诉后点击"查看进度" | ✅ 打开 content-governance 并定位到对应申诉 |
| **墓地治理跳转** | 墓地详情页点击"治理操作" | ✅ 打开 grave-governance 并预填ID |

---

## 📖 用户文档更新

### 更新 README.md

**添加章节**：

```markdown
## 🏛️ 治理功能说明

MemoPark 提供两个平台：

### 📱 DAPP（移动端优先）
- **地址**：http://localhost:5173
- **定位**：大众参与，日常使用
- **功能**：
  - ✅ 创建墓地和逝者
  - ✅ 供奉、留言、扫墓
  - ✅ 查看墓地详情
  - ✅ 提交申诉（简化版）
  - ✅ 查看我的治理摘要

### 🖥️ Web治理平台（桌面端优先）
- **地址**：https://governance.memopark.com
- **定位**：专业治理，批量操作
- **功能**：
  - ✅ 内容治理（申诉审批、批量处理）
  - ✅ 委员会管理（提案、投票、执行）
  - ✅ 做市商审批
  - ✅ 仲裁管理
  - ✅ 墓地/陵园强制治理
  - ✅ 轨道系统和公投管理
  - ✅ 数据分析和导出

### 🔗 如何选择？

| 你想做什么 | 使用平台 |
|-----------|---------|
| 创建墓地、添加逝者 | 📱 DAPP |
| 供奉、留言、浏览 | 📱 DAPP |
| 提交申诉（快速） | 📱 DAPP |
| 审批申诉 | 🖥️ Web |
| 委员会投票 | 🖥️ Web |
| 做市商审核 | 🖥️ Web |
| 仲裁争议 | 🖥️ Web |
| 强制治理操作 | 🖥️ Web |
```

---

## ⏱️ 实施时间线

### 总耗时：4.5 天

```
Day 1: 准备 + 删除
├── 上午：备份代码、确认清单
├── 下午：删除文件、清理路由
└── 晚上：初步编译测试

Day 2: 清理 + 改造
├── 上午：清理 lib/governance.ts
├── 下午：改造 SubmitAppealPage
└── 晚上：改造 MyGovernancePage

Day 3: 引导 + 测试
├── 上午：添加引导入口（首页、个人中心）
├── 下午：修改 AppealEntry 组件
└── 晚上：修改 BottomNav

Day 4: 测试 + 文档
├── 上午：功能测试
├── 下午：跳转测试
└── 晚上：更新文档

Day 5: 验证 + 部署（半天）
├── 上午：最终验证
└── 中午：部署到测试环境
```

---

## 📊 预期效果对比

### 代码指标

| 指标 | 清理前 | 清理后 | 改善 |
|------|--------|--------|------|
| **总文件数** | ~170 | ~150 | -12% |
| **总代码行数** | ~11,000 | ~7,800 | -29% |
| **治理代码** | ~3,200 | ~300 | -91% |
| **路由数量** | ~40 | ~27 | -33% |
| **打包体积** | ~2.5 MB | ~1.8 MB | -28% |
| **首屏加载** | ~1.2s | ~0.9s | -25% |

### 维护指标

| 指标 | 清理前 | 清理后 | 改善 |
|------|--------|--------|------|
| **治理功能维护成本** | 2人天/周 | 0.2人天/周 | -90% |
| **Bug修复时间** | 需同步两边 | 只改一处 | -50% |
| **新功能开发** | 两边同步 | 专注一边 | -50% |

### 用户指标

| 指标 | 清理前 | 清理后 | 说明 |
|------|--------|--------|------|
| **普通用户影响** | - | 几乎无 | 核心功能不变 |
| **专业用户体验** | 移动端受限 | 桌面端专业 | 获得更强工具 |
| **跨平台跳转** | 无 | 需要 | 引导清晰可接受 |

---

## 🎯 总结建议

### ✅ 强烈推荐执行清理

**理由**：

1. **职能分离清晰**：
   - DAPP = 移动端 + 大众参与 + 高频操作
   - Governance = 桌面端 + 专业治理 + 低频决策

2. **收益显著**：
   - 代码减少 29%
   - 维护成本降低 90%
   - 打包体积减小 28%

3. **风险可控**：
   - 技术可行性 95%
   - 用户影响可控
   - 有完整的缓解措施

4. **符合项目规则**：
   - 规则2：设计pallet之间要做到低耦合 ✅
   - 规则8：必须检查是否有冗余源代码 ✅
   - 规则14：设计修改pallet源代码时，必须同时优化设计前端页面 ✅

---

### 📅 执行建议

**推荐时机**：
- ✅ 现在（测试网阶段）：影响范围可控
- ⚠️ 主网上线前：避免影响生产用户

**执行顺序**：
1. 先备份（必须）
2. 删除文件
3. 修改路由
4. 改造保留功能
5. 添加引导
6. 测试验证
7. 更新文档

**验收标准**：
- ✅ 编译无错误
- ✅ 核心功能正常
- ✅ 跳转流畅
- ✅ 用户引导清晰

---

*生成时间：2025-10-03*
*文档版本：v1.0*

