# 八字功能重构指南

## 重构目标

将前端的八字计算逻辑移除，改为完全依赖链端生成，实现：
- ✅ 算法一致性：避免前后端算法不同步
- ✅ 自动升级：链端升级算法，前端无需更新
- ✅ 减少体积：前端代码更轻量
- ✅ 免费计算：Runtime API 不消耗 gas

## 已完成的重构

### 1. `baziService.ts` ✅

**变更内容：**
- 移除所有农历转换、四柱计算、大运流年等计算函数（约 600 行代码）
- 保留类型导出和辅助函数
- 添加废弃提示，引导开发者使用链端 API

**新用法：**
```typescript
// ❌ 旧方式：前端计算
import { calculateBazi } from '../../services/baziService';
const result = calculateBazi(input);

// ✅ 新方式：链端生成
import { saveBaziToChain, getInterpretation } from '../../services/baziChainService';
const chartId = await saveBaziToChain(input);
const interpretation = await getInterpretation(chartId);
```

### 2. `BaziPage.tsx` ✅

**变更内容：**
- 移除前端计算流程
- 改为提交到链端 → 获取 Runtime API 解盘结果
- 显示链端生成的解盘核心信息（格局、用神、喜神、忌神、评分等）
- 显示性格分析（主要特点、优点、缺点、适合职业）

**流程对比：**

旧流程：
```
用户输入 → calculateBazi() → 前端计算 → 显示结果 → 保存到链
```

新流程：
```
用户输入 → saveBaziToChain() → 链端生成 → getInterpretation() → 显示结果
```

## 待处理的文件

### 3. `BaziDetailPage.tsx` ⚠️ 需要更新

**当前问题：**
- 第139行：仍在使用前端计算 `calculateBazi()`
- 第201行：使用前端 `formatBazi()` 函数

**建议修改：**

```typescript
// 加载八字数据
const loadBaziData = useCallback(async () => {
  setLoading(true);
  try {
    // 从链上获取八字命盘
    const chart = await getBaziChart(baziId);
    if (!chart) {
      message.error('未找到该八字命盘');
      return;
    }
    setChartData(chart);

    // ❌ 旧方式：前端重新计算
    // const calculatedResult = calculateBazi(baziInput);
    // setResult(calculatedResult);

    // ✅ 新方式：通过 Runtime API 获取链上生成的解盘
    const interpretation = await getInterpretation(baziId);
    if (!interpretation) {
      throw new Error('获取解盘失败');
    }
    setInterpretation(interpretation);

    setLoading(false);
  } catch (error) {
    console.error('加载八字数据失败:', error);
    message.error(`加载失败: ${error.message}`);
    setLoading(false);
  }
}, [baziId]);
```

**数据结构映射：**

链端 `V3FullInterpretation` 提供：
- `core`: 格局、强弱、用神、喜神、忌神、评分、可信度
- `xingGe`: 性格分析（主要特点、优点、缺点、适合职业）
- `extendedJiShen`: 扩展忌神列表

如果需要四柱干支字符串：
```typescript
// ✅ 使用链端数据 + types/bazi.ts 辅助函数
import { getGanZhiName } from '../../types/bazi';

// 从 interpretation.core 或通过 Runtime API 获取四柱索引
// 然后格式化显示
const nianZhuStr = getGanZhiName({ tianGan, diZhi });
```

### 4. `BaziListPage.tsx` ⚠️ 需要检查

**可能需要更新的地方：**
- 如果列表页展示八字字符串，改为从链上获取四柱索引并格式化
- 如果有快速预览功能，使用 Runtime API 获取基础解盘

### 5. 组件 `components/BasicInterpretationCard.tsx` ⚠️ 需要检查

如果此组件依赖前端计算结果，需要更新为使用链端解盘数据。

## Runtime API 使用指南

### 获取完整解盘（推荐）

```typescript
import { getInterpretation } from '../../services/baziChainService';

const interpretation = await getInterpretation(chartId);

// 返回结构：
// {
//   core: {
//     geJu: '正格',
//     qiangRuo: '身旺',
//     yongShen: '木',
//     xiShen: '水',
//     jiShen: '金',
//     yongShenType: '扶抑用神',
//     score: 75,
//     confidence: 85,
//     timestamp: 12345,
//     algorithmVersion: 3
//   },
//   xingGe: {
//     zhuYaoTeDian: ['正直', '有主见'],
//     youDian: ['积极向上'],
//     queDian: ['固执'],
//     shiHeZhiYe: ['教育', '文化']
//   },
//   extendedJiShen: ['火', '土']
// }
```

### 链端优势

1. **免费计算**：Runtime API 调用不消耗 gas
2. **实时算法**：自动使用链端最新算法
3. **高性能**：响应速度 < 100ms
4. **算法一致**：与链端完全相同的计算逻辑

## 类型导入更新

确保从正确的位置导入类型和辅助函数：

```typescript
// ✅ 类型和常量从 types/bazi.ts
import {
  Gender,
  GENDER_NAMES,
  TIAN_GAN_NAMES,
  DI_ZHI_NAMES,
  WU_XING_NAMES,
  WU_XING_COLORS,
  getGanZhiName,
  calculateShiShen,
} from '../../types/bazi';

// ✅ 链端交互从 baziChainService.ts
import {
  saveBaziToChain,
  getBaziChart,
  getInterpretation,
  type V3FullInterpretation,
} from '../../services/baziChainService';

// ❌ 不再从 baziService.ts 导入计算函数
// import { calculateBazi, formatBazi } from '../../services/baziService'; // 已废弃
```

## 测试清单

完成重构后，请测试以下功能：

- [ ] 八字排盘：输入出生信息 → 链端生成 → 显示结果
- [ ] 解盘展示：格局、用神、性格分析等信息正确显示
- [ ] 详情页面：可以查看已保存的命盘详情
- [ ] 列表页面：历史命盘列表展示正常
- [ ] AI解读：可以正常请求 AI 解读
- [ ] 分享功能：可以分享命盘链接
- [ ] NFT铸造：可以将命盘铸造为 NFT

## 迁移注意事项

1. **不要删除 baziService.ts**：虽然计算逻辑已移除，但类型导出仍然需要
2. **渐进式迁移**：可以先保留旧代码，添加链端调用，测试通过后再移除旧代码
3. **错误处理**：链端调用可能失败，添加适当的错误处理和降级方案
4. **性能优化**：Runtime API 调用很快，但仍建议缓存结果避免重复调用
5. **兼容性**：确保旧数据（IPFS 存储的）仍然可以正常显示

## 常见问题

### Q: 如果链端算法与前端不一致怎么办？
A: 这正是重构的目的。现在算法唯一来源是链端，不会出现不一致。

### Q: 如果节点不可用怎么办？
A: 添加节点状态检查（已有 `NodeStatusChecker`），提示用户节点不可用。

### Q: 历史数据（IPFS）如何处理？
A: 保留 IPFS 数据作为备份，但主要展示改为链端生成结果。

### Q: 如何获取四柱干支字符串？
A: 从链端获取四柱索引，使用 `getGanZhiName()` 格式化。或者在详情页通过 Runtime API 获取完整四柱。

## 参考资料

- 链端 pallet: `pallets/divination/bazi/`
- Runtime API 文档: `pallets/divination/bazi/src/runtime_api.rs`
- 前端链端服务: `src/services/baziChainService.ts`
- 类型定义: `src/types/bazi.ts`
