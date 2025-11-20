# pallet-stardust-ipfs 前端API适配指南

> **版本**: v2.0（支持Tier分层配置）  
> **适用**: stardust-dapp  
> **更新日期**: 2025-10-26

---

## 📋 概览

本指南详细说明如何在前端适配优化后的`pallet-stardust-ipfs` API。

---

## ⚠️ 破坏式修改说明

### API签名变化

####前（v1.0）:
```typescript
api.tx.memoIpfs.requestPinForDeceased(
    deceasedId: u64,
    cidHash: Hash,      // ❌ CID哈希
    sizeBytes: u64,     // ❌ 手动指定大小
    replicas: u32,      // ❌ 手动指定副本数
    price: Balance,     // ❌ 手动指定价格
)
```

#### 新（v2.0）:
```typescript
api.tx.memoIpfs.requestPinForDeceased(
    deceasedId: u64,
    cid: Vec<u8>,            // ✅ 明文CID（如"QmXyz..."）
    tier: Option<PinTier>,   // ✅ 分层等级（可选）
)
```

---

## 🔧 步骤1：更新类型定义

### 添加新类型

在`src/types/chain.ts`中添加：

```typescript
// Tier分层等级
export enum PinTier {
    Critical = 'Critical',
    Standard = 'Standard',
    Temporary = 'Temporary',
}

// Tier配置
export interface TierConfig {
    replicas: number;
    healthCheckInterval: number;
    feeMultiplier: number;
    gracePeriodBlocks: number;
    enabled: boolean;
}

// Subject类型
export enum SubjectType {
    Deceased = 'Deceased',
    Grave = 'Grave',
    Offerings = 'Offerings',
    OtcOrder = 'OtcOrder',
    Evidence = 'Evidence',
    Custom = 'Custom',
}

// 健康状态
export enum HealthStatus {
    Unknown = 'Unknown',
    Healthy = 'Healthy',
    Degraded = 'Degraded',
    Critical = 'Critical',
}

// 全局健康统计
export interface GlobalHealthStats {
    totalPins: bigint;
    totalSizeBytes: bigint;
    healthyCount: bigint;
    degradedCount: bigint;
    criticalCount: bigint;
    lastFullScan: number;
    totalRepairs: bigint;
}
```

---

## 📝 步骤2：更新服务层

### 修改 `src/services/ipfs.ts`

```typescript
import { ApiPromise } from '@polkadot/api';
import { PinTier } from '../types/chain';

export class IpfsService {
    constructor(private api: ApiPromise) {}
    
    /**
     * 为逝者Pin CID（新API）
     * @param deceasedId 逝者ID
     * @param cid 明文CID（如"QmXyz..."）
     * @param tier 分层等级（可选，默认Standard）
     */
    async pinForDeceased(
        deceasedId: number,
        cid: string,
        tier?: PinTier
    ) {
        // 将CID字符串转换为Uint8Array
        const cidBytes = new TextEncoder().encode(cid);
        
        // 构造交易
        const tx = this.api.tx.memoIpfs.requestPinForDeceased(
            deceasedId,
            cidBytes,
            tier || null  // null表示使用默认Standard
        );
        
        return tx;
    }
    
    /**
     * 为墓位Pin CID（新API）
     */
    async pinForGrave(
        graveId: number,
        cid: string,
        tier?: PinTier
    ) {
        const cidBytes = new TextEncoder().encode(cid);
        
        const tx = this.api.tx.memoIpfs.requestPinForGrave(
            graveId,
            cidBytes,
            tier || null
        );
        
        return tx;
    }
    
    /**
     * 查询Tier配置
     */
    async getTierConfig(tier: PinTier): Promise<TierConfig | null> {
        const config = await this.api.query.memoIpfs.pinTierConfig(tier);
        
        if (config.isNone) {
            return null;
        }
        
        const unwrapped = config.unwrap();
        return {
            replicas: unwrapped.replicas.toNumber(),
            healthCheckInterval: unwrapped.healthCheckInterval.toNumber(),
            feeMultiplier: unwrapped.feeMultiplier.toNumber(),
            gracePeriodBlocks: unwrapped.gracePeriodBlocks.toNumber(),
            enabled: unwrapped.enabled.isTrue,
        };
    }
    
    /**
     * 查询全局健康统计
     */
    async getGlobalHealthStats(): Promise<GlobalHealthStats> {
        const stats = await this.api.query.memoIpfs.healthCheckStats();
        
        return {
            totalPins: stats.totalPins.toBigInt(),
            totalSizeBytes: stats.totalSizeBytes.toBigInt(),
            healthyCount: stats.healthyCount.toBigInt(),
            degradedCount: stats.degradedCount.toBigInt(),
            criticalCount: stats.criticalCount.toBigInt(),
            lastFullScan: stats.lastFullScan.toNumber(),
            totalRepairs: stats.totalRepairs.toBigInt(),
        };
    }
    
    /**
     * 查询CID的健康状态
     */
    async getCidHealthStatus(cid: string): Promise<HealthStatus> {
        const cidBytes = new TextEncoder().encode(cid);
        const cidHash = this.api.createType('Hash', cidBytes);
        
        // 查询健康巡检队列
        const tasks = await this.api.query.memoIpfs.healthCheckQueue.entries();
        
        for (const [key, task] of tasks) {
            const [, hash] = key.args;
            if (hash.eq(cidHash)) {
                const status = task.lastStatus;
                if (status.isHealthy) return HealthStatus.Healthy;
                if (status.isDegraded) return HealthStatus.Degraded;
                if (status.isCritical) return HealthStatus.Critical;
            }
        }
        
        return HealthStatus.Unknown;
    }
    
    /**
     * 运营者领取奖励
     */
    async claimOperatorRewards() {
        return this.api.tx.memoIpfs.operatorClaimRewards();
    }
}
```

---

## 🎨 步骤3：更新UI组件

### 示例1：简单模式（单按钮上传）

```typescript
// src/components/IpfsUpload.tsx
import React from 'react';
import { Button } from 'antd';
import { useApi } from '../hooks/useApi';
import { IpfsService } from '../services/ipfs';

export const IpfsUpload: React.FC<{
    deceasedId: number;
    onSuccess?: () => void;
}> = ({ deceasedId, onSuccess }) => {
    const { api } = useApi();
    const [loading, setLoading] = React.useState(false);
    
    const handleUpload = async (file: File) => {
        setLoading(true);
        try {
            // 1. 上传到IPFS（假设已有IPFS客户端）
            const cid = await uploadToIpfs(file);
            
            // 2. 调用链上Pin（使用默认Standard tier）
            const ipfsService = new IpfsService(api);
            const tx = await ipfsService.pinForDeceased(
                deceasedId,
                cid
                // 不传tier参数，使用默认Standard
            );
            
            // 3. 签名并发送
            await tx.signAndSend(currentAccount, (result) => {
                if (result.status.isInBlock) {
                    message.success('上传成功！');
                    onSuccess?.();
                }
            });
        } catch (error) {
            message.error('上传失败：' + error.message);
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <Upload
            customRequest={({ file }) => handleUpload(file as File)}
            showUploadList={false}
        >
            <Button loading={loading}>上传到IPFS</Button>
        </Upload>
    );
};
```

---

### 示例2：高级模式（带Tier选择）

```typescript
// src/components/IpfsUploadAdvanced.tsx
import React from 'react';
import { Button, Select, Tooltip, Space, Tag } from 'antd';
import { PinTier } from '../types/chain';

export const IpfsUploadAdvanced: React.FC<{
    deceasedId: number;
}> = ({ deceasedId }) => {
    const [tier, setTier] = React.useState<PinTier>(PinTier.Standard);
    const [configs, setConfigs] = React.useState<Record<PinTier, TierConfig>>({});
    
    // 加载tier配置
    React.useEffect(() => {
        loadTierConfigs();
    }, []);
    
    const loadTierConfigs = async () => {
        const ipfsService = new IpfsService(api);
        const critical = await ipfsService.getTierConfig(PinTier.Critical);
        const standard = await ipfsService.getTierConfig(PinTier.Standard);
        const temporary = await ipfsService.getTierConfig(PinTier.Temporary);
        
        setConfigs({
            [PinTier.Critical]: critical!,
            [PinTier.Standard]: standard!,
            [PinTier.Temporary]: temporary!,
        });
    };
    
    const handleUpload = async (file: File) => {
        const cid = await uploadToIpfs(file);
        const ipfsService = new IpfsService(api);
        
        // 使用选择的tier
        const tx = await ipfsService.pinForDeceased(deceasedId, cid, tier);
        
        await tx.signAndSend(currentAccount);
    };
    
    const renderTierOption = (t: PinTier) => {
        const config = configs[t];
        if (!config) return null;
        
        const costMultiplier = config.feeMultiplier / 10000;
        
        return (
            <Select.Option key={t} value={t}>
                <Space>
                    <Tag color={
                        t === PinTier.Critical ? 'red' :
                        t === PinTier.Standard ? 'blue' : 'green'
                    }>
                        {t}
                    </Tag>
                    <span>
                        {config.replicas}副本 · {costMultiplier}x费率
                    </span>
                </Space>
            </Select.Option>
        );
    };
    
    return (
        <Space direction="vertical" style={{ width: '100%' }}>
            <Select
                value={tier}
                onChange={setTier}
                style={{ width: '100%' }}
            >
                {renderTierOption(PinTier.Critical)}
                {renderTierOption(PinTier.Standard)}
                {renderTierOption(PinTier.Temporary)}
            </Select>
            
            <Upload
                customRequest={({ file }) => handleUpload(file as File)}
            >
                <Button type="primary">上传到IPFS</Button>
            </Upload>
            
            {/* 费用预估提示 */}
            <TierCostEstimate tier={tier} config={configs[tier]} />
        </Space>
    );
};
```

---

### 示例3：Tier费用预估组件

```typescript
// src/components/TierCostEstimate.tsx
import React from 'react';
import { Card, Descriptions, Tag } from 'antd';
import { TierConfig } from '../types/chain';

export const TierCostEstimate: React.FC<{
    tier: PinTier;
    config?: TierConfig;
}> = ({ tier, config }) => {
    if (!config) return null;
    
    const costMultiplier = config.feeMultiplier / 10000;
    const baseCost = 10; // 假设基础费率为10 DUST/月
    const estimatedCost = baseCost * costMultiplier * config.replicas;
    
    return (
        <Card size="small" title="费用预估">
            <Descriptions column={1} size="small">
                <Descriptions.Item label="等级">
                    <Tag color={
                        tier === PinTier.Critical ? 'red' :
                        tier === PinTier.Standard ? 'blue' : 'green'
                    }>
                        {tier}
                    </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="副本数">
                    {config.replicas} 份
                </Descriptions.Item>
                <Descriptions.Item label="费率">
                    {costMultiplier}x
                </Descriptions.Item>
                <Descriptions.Item label="预估费用">
                    ~{estimatedCost.toFixed(2)} DUST/月
                </Descriptions.Item>
                <Descriptions.Item label="巡检周期">
                    每 {(config.healthCheckInterval / 7200).toFixed(1)} 小时
                </Descriptions.Item>
                <Descriptions.Item label="宽限期">
                    {(config.gracePeriodBlocks / 14400).toFixed(0)} 天
                </Descriptions.Item>
            </Descriptions>
        </Card>
    );
};
```

---

## 📊 步骤4：监控仪表板

### 全局健康统计仪表板

```typescript
// src/pages/IpfsHealthDashboard.tsx
import React from 'react';
import { Card, Row, Col, Statistic, Progress, Timeline } from 'antd';
import { IpfsService } from '../services/ipfs';

export const IpfsHealthDashboard: React.FC = () => {
    const { api } = useApi();
    const [stats, setStats] = React.useState<GlobalHealthStats | null>(null);
    
    React.useEffect(() => {
        loadStats();
        const interval = setInterval(loadStats, 60000); // 每分钟刷新
        return () => clearInterval(interval);
    }, []);
    
    const loadStats = async () => {
        const ipfsService = new IpfsService(api);
        const data = await ipfsService.getGlobalHealthStats();
        setStats(data);
    };
    
    if (!stats) return <Spin />;
    
    const totalPins = Number(stats.totalPins);
    const healthyRate = totalPins > 0 
        ? (Number(stats.healthyCount) / totalPins) * 100 
        : 0;
    
    return (
        <div className="ipfs-health-dashboard">
            <Row gutter={[16, 16]}>
                {/* 总览统计 */}
                <Col span={6}>
                    <Card>
                        <Statistic
                            title="总Pin数量"
                            value={totalPins}
                            suffix="个"
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card>
                        <Statistic
                            title="总存储量"
                            value={(Number(stats.totalSizeBytes) / 1024 / 1024 / 1024).toFixed(2)}
                            suffix="GB"
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card>
                        <Statistic
                            title="健康率"
                            value={healthyRate.toFixed(1)}
                            suffix="%"
                            valueStyle={{ color: healthyRate > 90 ? '#3f8600' : '#cf1322' }}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card>
                        <Statistic
                            title="累计修复"
                            value={Number(stats.totalRepairs)}
                            suffix="次"
                        />
                    </Card>
                </Col>
                
                {/* 健康分布 */}
                <Col span={12}>
                    <Card title="健康状态分布">
                        <Space direction="vertical" style={{ width: '100%' }}>
                            <Progress
                                percent={healthyRate}
                                status="success"
                                format={() => `健康: ${stats.healthyCount}`}
                            />
                            <Progress
                                percent={(Number(stats.degradedCount) / totalPins) * 100}
                                status="active"
                                format={() => `降级: ${stats.degradedCount}`}
                            />
                            <Progress
                                percent={(Number(stats.criticalCount) / totalPins) * 100}
                                status="exception"
                                format={() => `危险: ${stats.criticalCount}`}
                            />
                        </Space>
                    </Card>
                </Col>
                
                {/* 最近巡检时间 */}
                <Col span={12}>
                    <Card title="系统信息">
                        <Timeline>
                            <Timeline.Item color="green">
                                上次全量扫描: 块 #{stats.lastFullScan}
                            </Timeline.Item>
                            <Timeline.Item>
                                下次扫描: 块 #{stats.lastFullScan + 7200}
                            </Timeline.Item>
                        </Timeline>
                    </Card>
                </Col>
            </Row>
        </div>
    );
};
```

---

## 🔔 步骤5：实时告警组件

### 订阅链上事件

```typescript
// src/hooks/useIpfsAlerts.ts
import { useEffect, useState } from 'react';
import { useApi } from './useApi';
import { notification } from 'antd';

export const useIpfsAlerts = () => {
    const { api } = useApi();
    
    useEffect(() => {
        if (!api) return;
        
        // 订阅降级告警
        const unsubDegraded = api.query.system.events((events) => {
            events.forEach((record) => {
                const { event } = record;
                
                if (api.events.memoIpfs.HealthDegraded.is(event)) {
                    const [cidHash, currentReplicas, target] = event.data;
                    
                    notification.warning({
                        message: '副本数降级',
                        description: `CID副本数降至 ${currentReplicas}/${target}`,
                        duration: 0,
                    });
                }
                
                if (api.events.memoIpfs.HealthCritical.is(event)) {
                    const [cidHash, currentReplicas] = event.data;
                    
                    notification.error({
                        message: '副本数危险',
                        description: `CID副本数仅剩 ${currentReplicas} 个！`,
                        duration: 0,
                    });
                }
                
                if (api.events.memoIpfs.GracePeriodStarted.is(event)) {
                    const [cidHash, expiresAt] = event.data;
                    
                    notification.warning({
                        message: '余额不足',
                        description: `存储费用不足，已进入宽限期。请在块 #${expiresAt} 前充值。`,
                        duration: 0,
                        btn: (
                            <Button
                                type="primary"
                                onClick={() => {
                                    // 跳转到充值页面
                                    window.location.href = '/topup';
                                }}
                            >
                                立即充值
                            </Button>
                        ),
                    });
                }
            });
        });
        
        return () => {
            unsubDegraded();
        };
    }, [api]);
};
```

---

## 🧪 步骤6：测试用例

### 单元测试

```typescript
// src/services/__tests__/ipfs.test.ts
import { IpfsService } from '../ipfs';
import { PinTier } from '../../types/chain';

describe('IpfsService', () => {
    let api: ApiPromise;
    let service: IpfsService;
    
    beforeEach(() => {
        api = createMockApi();
        service = new IpfsService(api);
    });
    
    it('should pin for deceased with default tier', async () => {
        const tx = await service.pinForDeceased(1, 'QmTest123');
        
        expect(tx.method.method).toBe('requestPinForDeceased');
        expect(tx.method.args[0].toNumber()).toBe(1);
        expect(tx.method.args[2].isNone).toBe(true); // tier为None
    });
    
    it('should pin for deceased with Critical tier', async () => {
        const tx = await service.pinForDeceased(1, 'QmTest123', PinTier.Critical);
        
        expect(tx.method.args[2].unwrap().isCritical).toBe(true);
    });
    
    it('should query tier config', async () => {
        const config = await service.getTierConfig(PinTier.Standard);
        
        expect(config).not.toBeNull();
        expect(config.replicas).toBe(3);
        expect(config.feeMultiplier).toBe(10000);
    });
});
```

---

### E2E测试

```typescript
// cypress/integration/ipfs.spec.ts
describe('IPFS Upload', () => {
    it('should upload file with Standard tier', () => {
        cy.visit('/deceased/1');
        cy.get('[data-testid="upload-btn"]').click();
        
        // 上传文件
        cy.get('input[type="file"]').attachFile('test.jpg');
        
        // 等待交易确认
        cy.contains('上传成功').should('be.visible');
    });
    
    it('should show tier selection in advanced mode', () => {
        cy.visit('/deceased/1/upload-advanced');
        
        // 打开tier选择器
        cy.get('.ant-select').click();
        
        // 验证选项
        cy.contains('Critical').should('be.visible');
        cy.contains('Standard').should('be.visible');
        cy.contains('Temporary').should('be.visible');
    });
});
```

---

## 📚 迁移指南

### 从v1.0迁移到v2.0

#### 1. 查找所有旧API调用

```bash
cd stardust-dapp
grep -r "requestPinForDeceased" src/
```

#### 2. 批量替换模式

使用VSCode的查找替换功能：

**查找正则**：
```
requestPinForDeceased\(\s*(\w+),\s*(\w+),\s*(\w+),\s*(\w+),\s*(\w+)\s*\)
```

**替换为**：
```
requestPinForDeceased($1, $2, null)  // 使用默认tier
```

#### 3. 手动调整复杂场景

对于需要不同tier的场景，手动调整：

```typescript
// 逝者核心档案 → Critical
api.tx.memoIpfs.requestPinForDeceased(
    deceasedId,
    cid,
    PinTier.Critical
);

// 普通供奉品 → Standard
api.tx.memoIpfs.requestPinForDeceased(
    offeringId,
    cid,
    PinTier.Standard
);

// 聊天记录 → Temporary
api.tx.memoIpfs.requestPinForDeceased(
    chatId,
    cid,
    PinTier.Temporary
);
```

---

## 🎯 最佳实践

### 1. Tier选择建议

| 内容类型 | 推荐Tier | 理由 |
|----------|----------|------|
| 逝者照片/视频 | Critical | 不可替代，需高可靠 |
| 遗嘱文件 | Critical | 法律效力，需永久保存 |
| 墓位封面 | Standard | 重要但可替换 |
| 普通供奉品 | Standard | 标准可靠性即可 |
| OTC聊天记录 | Temporary | 临时数据，低成本 |
| 临时预览图 | Temporary | 可随时重新生成 |

---

### 2. 错误处理

```typescript
try {
    const tx = await ipfsService.pinForDeceased(deceasedId, cid, tier);
    await tx.signAndSend(account);
} catch (error) {
    if (error.message.includes('AllThreeAccountsInsufficientBalance')) {
        message.error('余额不足，请先充值');
        // 引导用户充值
    } else if (error.message.includes('AlreadyPinned')) {
        message.warning('该文件已上传');
    } else {
        message.error('上传失败：' + error.message);
    }
}
```

---

### 3. 性能优化

```typescript
// 批量上传时使用并发控制
import pLimit from 'p-limit';

const limit = pLimit(3); // 最多3个并发

const uploadPromises = files.map(file =>
    limit(() => ipfsService.pinForDeceased(deceasedId, file.cid, tier))
);

await Promise.all(uploadPromises);
```

---

## 📞 技术支持

如遇问题，请参考：
- [IPFS-Pallet优化改造方案.md](./IPFS-Pallet优化改造方案.md)
- [Runtime集成配置指南.md](./Runtime集成配置指南.md)
- [IPFS存储费用模型与运营者激励.md](./IPFS存储费用模型与运营者激励.md)

---

**文档生成时间**：2025-10-26  
**维护者**：Stardust开发团队  
**版本**：v2.0

