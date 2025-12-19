/**
 * 八字排盘服务 - 链端生成版
 *
 * 重要说明：
 * - 八字计算逻辑已移至链端 (pallet-bazi-chart)
 * - 前端只负责：收集用户输入 → 提交到链端 → 展示链上生成的结果
 * - 本文件仅保留类型导出和辅助函数
 *
 * 架构优势：
 * 1. ✅ 算法唯一性：避免前后端算法不一致
 * 2. ✅ 自动升级：链端升级算法时，前端无需更新
 * 3. ✅ 减少体积：前端代码更轻量
 * 4. ✅ 免费计算：通过 Runtime API 免费获取解盘
 */

// 重新导出所有类型定义（从 types/bazi.ts）
export type {
  TianGan,
  DiZhi,
  WuXing,
  ShiShen,
  Gender,
  GanZhi,
  SiZhu,
  ZhuDetail,
  WuXingCount,
  DaYun,
  LiuNian,
  BaziInput,
  BaziResult,
} from '../types/bazi';

export {
  TIAN_GAN_NAMES,
  DI_ZHI_NAMES,
  TIAN_GAN_WU_XING,
  DI_ZHI_WU_XING,
  DI_ZHI_CANG_GAN,
  WU_XING_NAMES,
  WU_XING_COLORS,
  WU_XING_BG_COLORS,
  SHI_SHEN_NAMES,
  SHI_SHEN_SHORT,
  SHI_SHEN_COLORS,
  DI_ZHI_HOURS,
  GENDER_NAMES,
  getGanZhiName,
  calculateShiShen,
  getShiChenFromHour,
  isYangGan,
  nextGanZhi,
  prevGanZhi,
  getWuXingLack,
} from '../types/bazi';

/**
 * ⚠️ 已废弃：前端计算八字
 *
 * @deprecated 请使用链端生成：
 * 1. saveBaziToChain() 提交出生信息到链端
 * 2. getInterpretation(chartId) 获取链上生成的完整八字和解盘
 *
 * 示例：
 * ```typescript
 * // ❌ 旧方式：前端计算
 * const result = calculateBazi(input);
 *
 * // ✅ 新方式：链端生成
 * const chartId = await saveBaziToChain(input);
 * const interpretation = await getInterpretation(chartId);
 * ```
 */
export function calculateBazi(): never {
  throw new Error(
    '八字计算已迁移至链端。\n' +
    '请使用以下方式：\n' +
    '1. 调用 saveBaziToChain() 提交出生信息\n' +
    '2. 调用 getInterpretation(chartId) 获取链上生成的八字和解盘\n' +
    '详见 baziChainService.ts'
  );
}

/**
 * ⚠️ 已废弃：前端计算流年
 *
 * @deprecated 流年计算现由链端 Runtime API 提供
 * 请使用 getInterpretation(chartId) 获取完整八字信息（包含流年）
 */
export function calculateLiuNian(): never {
  throw new Error(
    '流年计算已迁移至链端。\n' +
    '请使用 getInterpretation(chartId) 获取完整八字信息。'
  );
}

/**
 * ⚠️ 已废弃：前端格式化八字
 *
 * @deprecated 八字格式化功能保留在 types/bazi.ts
 * 直接使用：import { getGanZhiName } from '../types/bazi'
 */
export function formatBazi(): never {
  throw new Error(
    '请使用 types/bazi.ts 中的 getGanZhiName() 函数格式化干支。'
  );
}

/**
 * ⚠️ 已废弃：前端获取当前流年
 *
 * @deprecated 请使用链端 Runtime API
 */
export function getCurrentLiuNian(): never {
  throw new Error(
    '流年信息已迁移至链端。\n' +
    '请使用 getInterpretation(chartId) 获取完整八字信息。'
  );
}
