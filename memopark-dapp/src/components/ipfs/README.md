# IPFS相关UI组件使用说明

## 📦 组件清单

### 1. PinStatusBadge
显示CID的Pin状态徽章

**功能**：
- 显示pin状态（pending/active/failed/unknown）
- 显示副本数（current/target）
- 支持轮询自动更新
- 悬停显示详细信息

**使用示例**：
```tsx
<PinStatusBadge 
  cid="0x1234..." 
  showReplicas={true}
  enablePolling={true}
/>
```

---

### 2. TripleChargeIndicator
显示三重扣款机制的余额和预估扣费来源

**功能**：
- 显示预估扣费来源
- 显示各账户余额
- 显示IPFS池配额使用情况
- 余额不足警告
- 紧凑模式/完整模式

**使用示例**：
```tsx
<TripleChargeIndicator
  deceasedId={100}
  caller="5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
  estimatedCost={3n * CHAIN_CONSTANTS.DEFAULT_STORAGE_PRICE}
  replicas={3}
  showDetails={true}
/>
```

---

## 🎨 设计原则

### 1. 一致的视觉语言

所有组件使用统一的：
- 颜色方案（绿色=成功/最优，橙色=警告/兜底，红色=错误/失败）
- 图标风格（Ant Design Icons）
- 间距和字体大小

### 2. 清晰的状态反馈

所有组件都提供清晰的状态反馈：
- Loading状态（Spin）
- Error状态（Alert）
- Success状态（Badge/Tag）

### 3. 友好的用户提示

所有组件都提供友好的用户提示：
- Tooltip悬停提示
- 详细的错误信息
- 充值引导

---

## 📖 详细使用指南

### PinStatusBadge完整示例

```tsx
import React from 'react';
import { List, Card } from 'antd';
import { PinStatusBadge } from '@/components/ipfs';

interface MediaItem {
  id: number;
  uri: string;
  name: string;
}

export const MediaList: React.FC<{ items: MediaItem[] }> = ({ items }) => {
  return (
    <List
      dataSource={items}
      renderItem={(item) => (
        <List.Item>
          <Card size="small" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{item.name}</span>
              <PinStatusBadge 
                cid={item.uri}
                showReplicas={true}
                enablePolling={true}
                pollingInterval={10000}
              />
            </div>
          </Card>
        </List.Item>
      )}
    />
  );
};
```

### TripleChargeIndicator完整示例

```tsx
import React, { useState } from 'react';
import { Modal, Button, Form, Input } from 'antd';
import { TripleChargeIndicator } from '@/components/ipfs';
import { CHAIN_CONSTANTS } from '@/types';

export const CreateDeceasedModal: React.FC<{
  visible: boolean;
  onClose: () => void;
}> = ({ visible, onClose }) => {
  const [form] = Form.useForm();
  const [deceasedId, setDeceasedId] = useState<number>(100);
  const caller = useCurrentAccount(); // 假设的hook

  const estimatedCost = 3n * CHAIN_CONSTANTS.DEFAULT_STORAGE_PRICE;

  const handleSubmit = async () => {
    const values = await form.validateFields();
    // 提交逻辑
  };

  return (
    <Modal
      title="创建逝者档案"
      visible={visible}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button key="submit" type="primary" onClick={handleSubmit}>
          确认创建
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical">
        <Form.Item label="姓名" name="name" rules={[{ required: true }]}>
          <Input placeholder="请输入姓名" />
        </Form.Item>
        
        {/* 其他表单项... */}

        {/* 扣费预览 */}
        <Form.Item label="费用预览">
          <TripleChargeIndicator
            deceasedId={deceasedId}
            caller={caller}
            estimatedCost={estimatedCost}
            replicas={3}
            showDetails={true}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};
```

### 紧凑模式示例

```tsx
import React from 'react';
import { Drawer, Space } from 'antd';
import { TripleChargeIndicator } from '@/components/ipfs';

export const QuickUploadDrawer: React.FC = () => {
  return (
    <Drawer title="快速上传" width={400}>
      <Space direction="vertical" style={{ width: '100%' }}>
        {/* 其他内容... */}
        
        {/* 紧凑模式的扣费提示 */}
        <TripleChargeIndicator
          deceasedId={100}
          caller="5GrwvaEF..."
          estimatedCost={3n * CHAIN_CONSTANTS.DEFAULT_STORAGE_PRICE}
          compact={true}
        />
      </Space>
    </Drawer>
  );
};
```

---

## 🎯 最佳实践

### 1. PinStatusBadge

**✅ 推荐**：
- 在列表中使用轮询（pollingInterval >= 10000）
- 显示副本数增加可信度
- 使用Tooltip显示详细信息

**❌ 避免**：
- 轮询间隔太短（< 5秒）会增加服务器负担
- 不要在每个列表项都使用独立的轮询

### 2. TripleChargeIndicator

**✅ 推荐**：
- 在创建/上传前显示扣费预览
- 余额不足时阻止提交
- 提供充值引导链接

**❌ 避免**：
- 不要隐藏余额不足警告
- 不要在用户无法操作的地方使用

---

## 🔧 自定义样式

所有组件都支持自定义样式：

```tsx
<PinStatusBadge 
  cid="0x1234..."
  style={{ fontSize: 14, fontWeight: 'bold' }}
  className="my-custom-badge"
/>

<TripleChargeIndicator
  deceasedId={100}
  caller="5GrwvaEF..."
  estimatedCost={3n * CHAIN_CONSTANTS.DEFAULT_STORAGE_PRICE}
  style={{ marginTop: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
/>
```

---

## 🌐 国际化支持

当前组件使用中文显示，未来可以通过以下方式支持多语言：

```tsx
// 示例：使用i18n
import { useTranslation } from 'react-i18next';

export const PinStatusBadge: React.FC<...> = (...) => {
  const { t } = useTranslation();
  
  return (
    <Badge 
      text={t(`pinStatus.${record.status}`)}
      // ...
    />
  );
};
```

---

## 📱 响应式设计

组件在移动端和桌面端都能良好显示：

```tsx
// 响应式布局示例
import { useMediaQuery } from 'react-responsive';

export const ResponsiveCharge: React.FC = () => {
  const isMobile = useMediaQuery({ maxWidth: 768 });

  return (
    <TripleChargeIndicator
      deceasedId={100}
      caller="5GrwvaEF..."
      estimatedCost={3n * CHAIN_CONSTANTS.DEFAULT_STORAGE_PRICE}
      compact={isMobile} // 移动端使用紧凑模式
      showDetails={!isMobile} // 桌面端显示详情
    />
  );
};
```

---

## 🧪 测试

### 单元测试示例

```tsx
import { render, screen } from '@testing-library/react';
import { PinStatusBadge } from './PinStatusBadge';

describe('PinStatusBadge', () => {
  it('应该显示loading状态', () => {
    render(<PinStatusBadge cid="0x1234" />);
    expect(screen.getByRole('img', { name: /loading/i })).toBeInTheDocument();
  });

  it('应该显示active状态', async () => {
    // Mock usePinStatus hook
    jest.mock('@/hooks', () => ({
      usePinStatus: () => ({
        record: {
          cid: '0x1234',
          status: 'active',
          currentReplicas: 3,
          targetReplicas: 3,
        },
        loading: false,
        error: null,
      }),
    }));

    render(<PinStatusBadge cid="0x1234" showReplicas={true} />);
    expect(await screen.findByText(/已Pin/i)).toBeInTheDocument();
  });
});
```

---

## ⚠️ 重要提示

### 当前状态：使用模拟数据

所有组件当前依赖的Hooks使用**模拟数据**，原因：
- pallet-stardust-ipfs尚未启用到runtime
- 链上查询API暂不可用

### 组件功能完整性

✅ **UI交互完全可用**
- 所有组件的UI和交互都已完成
- 可以进行完整的前端测试

⚠️ **数据不是真实的**
- 显示的余额、状态都是模拟数据
- 不会随链上状态变化

### 升级到实际数据

等pallet-stardust-ipfs启用后，组件无需任何修改，只需升级底层Hooks即可。

---

## 📝 迁移清单

等pallet-stardust-ipfs启用后：

- [ ] 升级底层Hooks（usePinStatus等）
- [ ] 测试组件显示实际链上数据
- [ ] 更新本README移除"模拟数据"说明
- [ ] 添加端到端测试

---

## ❓ 常见问题

**Q: 组件可以直接使用吗？**
A: 可以。UI和交互完全可用，只是数据是模拟的。

**Q: 如何判断是否使用模拟数据？**
A: 查看底层Hooks的实现，如果有"模拟数据"注释，说明在使用模拟数据。

**Q: 什么时候可以显示真实数据？**
A: 等pallet-stardust-ipfs启用后，升级Hooks即可，组件无需修改。

**Q: 为什么不直接在组件中集成真实API？**
A: 遵循关注点分离原则，组件只负责展示，数据获取由Hooks负责，便于维护和测试。

---

**文档版本**：v1.0  
**最后更新**：2025-10-12  
**状态**：✅ 组件已完成，使用模拟数据

