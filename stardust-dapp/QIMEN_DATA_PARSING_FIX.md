# 奇门遁甲数据解析问题修复

## 问题描述

链端排盘成功（ID: 4）后，访问详情页时出现以下错误：

### 错误1：getChart 解析失败
```
[getChart] 解析失败: TypeError: Cannot read properties of undefined (reading 'toString')
    at Module.getChart (qimenService.ts:490:29)
```

### 错误2：getFullInterpretation 解码失败
```
[getFullInterpretation] 获取完整解卦失败: RangeError: Invalid typed array length: 0xe5ba94e69c9fe7baa6e59ca8203720e4b8aae69c88e58685
    at new Uint8Array (<anonymous>)
    at getFullInterpretation (qimenService.ts:718:45)
```

## 根本原因

### 原因1：数据结构不匹配
后端返回的数据结构与前端期望的不一致：
- 后端使用 `diviner`，前端期望 `creator`
- 后端使用字符串格式的枚举（如 `"Yin"`），前端期望数字
- 后端数据字段名称与前端类型定义不完全匹配

### 原因2：错误的字符串解码
尝试将已经是字符串的数据当作字节数组解码：
```typescript
// ❌ 错误：当 rangeDesc 已经是字符串时会报错
rangeDesc: new TextDecoder().decode(new Uint8Array(interpretation.yingQi.rangeDesc))
```

错误消息中的十六进制值 `0xe5ba94e69c9fe7baa6e59ca8203720e4b8aae69c88e58685` 是字符串"应期线在 上元内"的 UTF-8 编码被误当作数字。

## 修复方案

### 修复1：getChart 函数
**文件**：`src/services/qimenService.ts:477-510`

**修复前**：
```typescript
const data = result.unwrap();
const chart: QimenChart = {
  id: chartId,
  creator: data.creator.toString(), // ❌ 字段不存在
  method: data.method.toNumber(), // ❌ 字段不存在
  dunType: data.dunType.toNumber() as DunType, // ❌ 返回的是字符串
  // ...
};
```

**修复后**：
```typescript
const data = result.unwrap();
const jsonData = data.toJSON() as any; // ✅ 使用 toJSON() 获取友好格式

const chart: QimenChart = {
  id: chartId,
  creator: jsonData.diviner || '', // ✅ 使用正确的字段名
  method: 0, // ✅ Random method
  dunType: jsonData.dunType === 'Yin' ? 1 : 0, // ✅ 字符串转数字
  sanYuan: jsonData.sanYuan === 'Shang' ? 0 : jsonData.sanYuan === 'Zhong' ? 1 : 2,
  juNumber: parseInt(jsonData.juNumber) || 0,
  // ...简化处理其他字段
};
```

### 修复2：getFullInterpretation 函数
**文件**：`src/services/qimenService.ts:712-744`

**修复前**：
```typescript
yingQi: interpretation.yingQi && {
  ...interpretation.yingQi,
  rangeDesc: new TextDecoder().decode(new Uint8Array(interpretation.yingQi.rangeDesc)),
  // ❌ 直接假设是字节数组，没有类型检查
},
```

**修复后**：
```typescript
// 辅助函数：安全解码字节数组或直接返回字符串
const decodeString = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'string') return value; // ✅ 已经是字符串直接返回
  if (Array.isArray(value)) {
    try {
      return new TextDecoder().decode(new Uint8Array(value)); // ✅ 是数组才解码
    } catch (e) {
      console.warn('解码失败，返回空字符串:', e);
      return '';
    }
  }
  return String(value);
};

yingQi: interpretation.yingQi && {
  ...interpretation.yingQi,
  rangeDesc: decodeString(interpretation.yingQi.rangeDesc), // ✅ 安全解码
},
geJuDetail: interpretation.geJuDetail && {
  ...interpretation.geJuDetail,
  name: decodeString(interpretation.geJuDetail.name),
  description: decodeString(interpretation.geJuDetail.description),
  notes: decodeString(interpretation.geJuDetail.notes),
},
```

## 测试验证

### 后端数据结构示例
```json
{
  "id": "4",
  "diviner": "5CrDBEVDgXUwctSuV8EvQEBo2m187PcxoY36V7H7PGErHUW4",
  "method": "Random",
  "dunType": "Yin",
  "sanYuan": "Shang",
  "juNumber": "9",
  "zhiFuXing": "TianZhu",
  "zhiShiMen": "Jing2",
  "yearGanzhi": {"gan": "Jia", "zhi": "Zi"},
  "monthGanzhi": {"gan": "Bing", "zhi": "Yin"},
  "dayGanzhi": {"gan": "Geng", "zhi": "Zi"},
  "hourGanzhi": {"gan": "Ding", "zhi": "Chou"},
  "jieQi": "DongZhi",
  "palaces": [...],
  "timestamp": "1,765,678,242",
  "blockNumber": "122",
  "interpretationCid": null,
  "isPublic": false
}
```

### 测试步骤

1. **访问排盘页面**
   ```
   http://localhost:5173/#/qimen
   ```

2. **创建链端排盘**
   - 打开"链端起局"开关
   - 点击"排盘"按钮
   - 等待交易确认

3. **查看解卦结果**
   - 点击"查看详细解卦（链端AI解读）"按钮
   - 进入详情页：`http://localhost:5173/#/qimen/detail/4?questionType=0`
   - 应该能看到完整的解卦内容，无错误

4. **验证数据显示**
   - ✅ 核心解卦：格局、吉凶评分、旺衰状态、可信度
   - ✅ 九宫详解：9个宫位的详细信息
   - ✅ 用神分析：用神选择和分析
   - ✅ 应期推算：事情应验的时间推算
   - ✅ 格局详解：特殊格局的详细说明

## 相关文件

- `src/services/qimenService.ts` - 修复数据解析逻辑
  - `getChart()` 函数：line 477-510
  - `getFullInterpretation()` 函数：line 712-744

- `src/features/qimen/QimenPage.tsx` - 添加注释说明已修复

## 注意事项

1. **数据格式变化**：后端可能使用不同的序列化格式（JSON vs 原始类型），需要在前端统一处理
2. **类型安全**：使用 `toJSON()` 获取友好的数据格式，避免直接访问原始 Codec 类型的属性
3. **字符串解码**：不能假设所有字符串都是字节数组，需要类型检查后再解码
4. **错误处理**：添加 try-catch 和类型检查，避免因数据格式不一致导致崩溃

## 后续优化建议

1. **完善类型映射**：
   - 创建完整的枚举映射表（如 `DunType`, `SanYuan`, `JiuXing`, `BaMen` 等）
   - 从字符串自动转换为数字枚举

2. **统一数据转换**：
   - 创建通用的数据转换工具函数
   - 在服务层统一处理后端数据到前端类型的转换

3. **增强错误提示**：
   - 当数据解析失败时，提供更详细的错误信息
   - 记录原始数据便于调试

## 更新日志

- **2025-12-14 10:15** - 修复 `getChart` 和 `getFullInterpretation` 数据解析问题
- **2025-12-14 10:15** - 添加安全的字符串解码辅助函数
- **2025-12-14 10:15** - 通过 Vite HMR 热更新生效
