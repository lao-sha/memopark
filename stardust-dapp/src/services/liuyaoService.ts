/**
 * 六爻占卜链端服务
 *
 * 提供与 pallet-liuyao 的交互，支持：
 * - 铜钱起卦（模拟三枚铜钱法）
 * - 数字起卦（报数法）
 * - 随机起卦（链上随机数）
 * - 手动指定起卦
 * - 卦象查询与管理
 * - AI 解读请求
 *
 * 六爻排盘系统包含：
 * - 纳甲装卦（八卦配天干地支）
 * - 世应计算（寻世诀）
 * - 卦宫归属（认宫诀）
 * - 六亲配置
 * - 六神排布
 * - 旬空计算
 * - 伏神查找
 * - 神煞计算（14种）
 * - 旺衰分析
 * - 日辰冲合分析
 * - 动爻作用分析
 */

import { getApi, getSignedApi } from '../lib/polkadot';
import type {
  YaoType,
  LiuyaoGua,
  YaoInfo,
  DiZhi,
  WuXing,
  LiuQin,
  LiuShen,
  TianGan,
  WangShuai,
  RiChenGuanXi,
  ShenSha,
  HuiTouZuoYong,
  ShenShaInfo,
} from '../types/liuyao';
import {
  GUA_NAMES,
  DI_ZHI_WU_XING,
} from '../types/liuyao';

// ==================== 类型定义 ====================

/**
 * 起卦方式
 */
export enum LiuyaoDivinationMethod {
  /** 铜钱起卦 */
  CoinMethod = 0,
  /** 数字起卦 */
  NumberMethod = 1,
  /** 随机起卦 */
  RandomMethod = 2,
  /** 手动指定 */
  ManualMethod = 3,
  /** 时间起卦 */
  TimeMethod = 4,
}

/**
 * 干支元组
 */
export type GanZhi = [number, number]; // [天干索引(0-9), 地支索引(0-11)]

// ==================== 起卦服务 ====================

/**
 * 铜钱起卦 - 模拟三枚铜钱法
 *
 * 传统的六爻起卦方法，每次摇三枚铜钱，记录阳面个数。
 * - 3个阳面 = 老阳（9分，变阴）
 * - 2个阳面 = 少阳（7分，不变）
 * - 1个阳面 = 少阴（8分，不变）
 * - 0个阳面 = 老阴（6分，变阳）
 *
 * @param coins - 六次摇卦结果，每个值为阳面个数(0-3)
 * @param yearGz - 年干支
 * @param monthGz - 月干支
 * @param dayGz - 日干支
 * @param hourGz - 时干支
 * @returns 卦象 ID
 */
export async function divineByCoins(
  coins: [number, number, number, number, number, number],
  yearGz: GanZhi,
  monthGz: GanZhi,
  dayGz: GanZhi,
  hourGz: GanZhi
): Promise<number> {
  const api = await getSignedApi();

  // 检查 liuyao pallet 是否存在
  if (!api.tx.liuyao || !api.tx.liuyao.divineByCoins) {
    throw new Error('区块链节点未包含六爻模块（pallet-liuyao），请检查节点配置');
  }

  const tx = api.tx.liuyao.divineByCoins(
    coins,
    yearGz,
    monthGz,
    dayGz,
    hourGz
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events, dispatchError }) => {
      console.log('[liuyao.divineByCoins] 交易状态:', status.type);

      // 检查调度错误
      if (dispatchError) {
        if (dispatchError.isModule) {
          const decoded = api.registry.findMetaError(dispatchError.asModule);
          const { docs, name, section } = decoded;
          reject(new Error(`${section}.${name}: ${docs.join(' ')}`));
        } else {
          reject(new Error(dispatchError.toString()));
        }
        return;
      }

      if (status.isInBlock || status.isFinalized) {
        console.log('[liuyao.divineByCoins] 交易已打包，事件数量:', events.length);
        const event = events.find((e) =>
          e.event.section === 'liuyao' && e.event.method === 'GuaCreated'
        );
        if (event) {
          const guaId = event.event.data[0].toNumber();
          console.log('[liuyao.divineByCoins] 起卦成功，卦象ID:', guaId);
          resolve(guaId);
        } else if (status.isFinalized) {
          console.error('[liuyao.divineByCoins] 未找到 GuaCreated 事件');
          reject(new Error('交易成功但未找到卦象创建事件'));
        }
      }
    }).catch((error) => {
      console.error('[liuyao.divineByCoins] 交易失败:', error);
      reject(error);
    });
  });
}

/**
 * 数字起卦 - 报数法
 *
 * 用户报两个数字，分别用于计算上卦和下卦，动爻位置由两数之和计算。
 *
 * @param upperNum - 上卦数（对应外卦，用户报的第一个数）
 * @param lowerNum - 下卦数（对应内卦，用户报的第二个数）
 * @param dong - 动爻位置（1-6，从初爻到上爻）
 * @param yearGz - 年干支
 * @param monthGz - 月干支
 * @param dayGz - 日干支
 * @param hourGz - 时干支
 * @returns 卦象 ID
 */
export async function divineByNumbers(
  upperNum: number,
  lowerNum: number,
  dong: number,
  yearGz: GanZhi,
  monthGz: GanZhi,
  dayGz: GanZhi,
  hourGz: GanZhi
): Promise<number> {
  const api = await getSignedApi();

  // 检查 liuyao pallet 是否存在
  if (!api.tx.liuyao || !api.tx.liuyao.divineByNumbers) {
    throw new Error('区块链节点未包含六爻模块（pallet-liuyao），请检查节点配置');
  }

  const tx = api.tx.liuyao.divineByNumbers(
    upperNum,
    lowerNum,
    dong,
    yearGz,
    monthGz,
    dayGz,
    hourGz
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events, dispatchError }) => {
      console.log('[liuyao.divineByNumbers] 交易状态:', status.type);

      if (dispatchError) {
        if (dispatchError.isModule) {
          const decoded = api.registry.findMetaError(dispatchError.asModule);
          const { docs, name, section } = decoded;
          reject(new Error(`${section}.${name}: ${docs.join(' ')}`));
        } else {
          reject(new Error(dispatchError.toString()));
        }
        return;
      }

      if (status.isInBlock || status.isFinalized) {
        const event = events.find((e) =>
          e.event.section === 'liuyao' && e.event.method === 'GuaCreated'
        );
        if (event) {
          const guaId = event.event.data[0].toNumber();
          console.log('[liuyao.divineByNumbers] 起卦成功，卦象ID:', guaId);
          resolve(guaId);
        } else if (status.isFinalized) {
          reject(new Error('交易成功但未找到卦象创建事件'));
        }
      }
    }).catch((error) => {
      console.error('[liuyao.divineByNumbers] 交易失败:', error);
      reject(error);
    });
  });
}

/**
 * 时间起卦 - 根据时间信息起卦
 *
 * 根据年、月、日、时的数字和干支信息自动生成卦象。
 *
 * @param yearZhi - 年支（0-11，对应子丑寅卯...）
 * @param monthNum - 月数（1-12）
 * @param dayNum - 日数（1-31）
 * @param hourZhi - 时支（0-11，对应子丑寅卯...）
 * @param yearGz - 年干支
 * @param monthGz - 月干支
 * @param dayGz - 日干支
 * @param hourGz - 时干支
 * @returns 卦象 ID
 */
export async function divineByTime(
  yearZhi: number,
  monthNum: number,
  dayNum: number,
  hourZhi: number,
  yearGz: GanZhi,
  monthGz: GanZhi,
  dayGz: GanZhi,
  hourGz: GanZhi
): Promise<number> {
  const api = await getSignedApi();

  // 检查 liuyao pallet 是否存在
  if (!api.tx.liuyao || !api.tx.liuyao.divineByTime) {
    throw new Error('区块链节点未包含六爻模块（pallet-liuyao），请检查节点配置');
  }

  const tx = api.tx.liuyao.divineByTime(
    yearZhi,
    monthNum,
    dayNum,
    hourZhi,
    yearGz,
    monthGz,
    dayGz,
    hourGz
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events, dispatchError }) => {
      console.log('[liuyao.divineByTime] 交易状态:', status.type);

      if (dispatchError) {
        if (dispatchError.isModule) {
          const decoded = api.registry.findMetaError(dispatchError.asModule);
          const { docs, name, section } = decoded;
          reject(new Error(`${section}.${name}: ${docs.join(' ')}`));
        } else {
          reject(new Error(dispatchError.toString()));
        }
        return;
      }

      if (status.isInBlock || status.isFinalized) {
        const event = events.find((e) =>
          e.event.section === 'liuyao' && e.event.method === 'GuaCreated'
        );
        if (event) {
          const guaId = event.event.data[0].toNumber();
          console.log('[liuyao.divineByTime] 起卦成功，卦象ID:', guaId);
          resolve(guaId);
        } else if (status.isFinalized) {
          reject(new Error('交易成功但未找到卦象创建事件'));
        }
      }
    }).catch((error) => {
      console.error('[liuyao.divineByTime] 交易失败:', error);
      reject(error);
    });
  });
}

/**
 * 随机起卦 - 使用链上随机数
 *
 * 使用链上随机数生成卦象，适合无特定方法时使用。
 *
 * @returns 卦象 ID
 */
export async function divineRandom(): Promise<number> {
  const api = await getSignedApi();

  // 检查 liuyao pallet 是否存在
  if (!api.tx.liuyao || !api.tx.liuyao.divineRandom) {
    throw new Error('区块链节点未包含六爻模块（pallet-liuyao），请检查节点配置');
  }

  const tx = api.tx.liuyao.divineRandom();

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events, dispatchError }) => {
      console.log('[liuyao.divineRandom] 交易状态:', status.type);

      if (dispatchError) {
        if (dispatchError.isModule) {
          const decoded = api.registry.findMetaError(dispatchError.asModule);
          const { docs, name, section } = decoded;
          reject(new Error(`${section}.${name}: ${docs.join(' ')}`));
        } else {
          reject(new Error(dispatchError.toString()));
        }
        return;
      }

      if (status.isInBlock || status.isFinalized) {
        const event = events.find((e) =>
          e.event.section === 'liuyao' && e.event.method === 'GuaCreated'
        );
        if (event) {
          const guaId = event.event.data[0].toNumber();
          console.log('[liuyao.divineRandom] 起卦成功，卦象ID:', guaId);
          resolve(guaId);
        } else if (status.isFinalized) {
          reject(new Error('交易成功但未找到卦象创建事件'));
        }
      }
    }).catch((error) => {
      console.error('[liuyao.divineRandom] 交易失败:', error);
      reject(error);
    });
  });
}

/**
 * 手动起卦 - 直接输入六爻
 *
 * @param yaos - 六爻类型（0=少阴, 1=少阳, 2=老阴, 3=老阳）
 * @param yearGz - 年干支
 * @param monthGz - 月干支
 * @param dayGz - 日干支
 * @param hourGz - 时干支
 * @returns 卦象 ID
 */
export async function divineManual(
  yaos: [number, number, number, number, number, number],
  yearGz: GanZhi,
  monthGz: GanZhi,
  dayGz: GanZhi,
  hourGz: GanZhi
): Promise<number> {
  const api = await getSignedApi();

  // 检查 liuyao pallet 是否存在
  if (!api.tx.liuyao || !api.tx.liuyao.divineManual) {
    throw new Error('区块链节点未包含六爻模块（pallet-liuyao），请检查节点配置');
  }

  const tx = api.tx.liuyao.divineManual(
    yaos,
    yearGz,
    monthGz,
    dayGz,
    hourGz
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events, dispatchError }) => {
      console.log('[liuyao.divineManual] 交易状态:', status.type);

      if (dispatchError) {
        if (dispatchError.isModule) {
          const decoded = api.registry.findMetaError(dispatchError.asModule);
          const { docs, name, section } = decoded;
          reject(new Error(`${section}.${name}: ${docs.join(' ')}`));
        } else {
          reject(new Error(dispatchError.toString()));
        }
        return;
      }

      if (status.isInBlock || status.isFinalized) {
        const event = events.find((e) =>
          e.event.section === 'liuyao' && e.event.method === 'GuaCreated'
        );
        if (event) {
          const guaId = event.event.data[0].toNumber();
          console.log('[liuyao.divineManual] 起卦成功，卦象ID:', guaId);
          resolve(guaId);
        } else if (status.isFinalized) {
          reject(new Error('交易成功但未找到卦象创建事件'));
        }
      }
    }).catch((error) => {
      console.error('[liuyao.divineManual] 交易失败:', error);
      reject(error);
    });
  });
}

// ==================== 卦象查询服务 ====================

/**
 * 获取卦象详情
 *
 * @param guaId - 卦象 ID
 * @returns 卦象数据或 null
 */
export async function getGua(guaId: number): Promise<LiuyaoGua | null> {
  const api = await getApi();

  // 检查 liuyao pallet 是否存在
  if (!api.query.liuyao || !api.query.liuyao.guas) {
    console.error('[getGua] liuyao pallet 不存在');
    return null;
  }

  console.log('[getGua] 查询卦象 ID:', guaId);
  const result = await api.query.liuyao.guas(guaId);

  if (result.isNone) {
    console.log('[getGua] 卦象不存在');
    return null;
  }

  try {
    const data = result.unwrap();
    console.log('[getGua] 原始数据:', JSON.stringify(data.toHuman()));

    // 解析日干支
    const riGan = data.dayGz[0] as TianGan;
    const riChen = data.dayGz[1] as DiZhi;
    const yueJian = data.monthGz[1] as DiZhi;

    // 解析旬空
    const xunKong: [DiZhi, DiZhi] = [
      data.xunKong[0] as DiZhi,
      data.xunKong[1] as DiZhi,
    ];

    // 解析六爻信息
    const originalYaos = data.originalYaos;
    const yaos: YaoInfo[] = [];

    for (let i = 0; i < 6; i++) {
      const yaoData = originalYaos[i];
      const diZhi = yaoData.diZhi.toNumber() as DiZhi;
      const wuXing = yaoData.wuXing.toNumber() as WuXing;

      // 计算旺衰
      const wangShuai = calculateWangShuaiLocal(wuXing, yueJian);

      // 计算日辰关系
      const riChenGuanXi = analyzeRiChenLocal(riChen, diZhi, wuXing);

      // 判断是否旬空
      const isXunKong = diZhi === xunKong[0] || diZhi === xunKong[1];

      yaos.push({
        position: i + 1,
        type: yaoData.yao.toNumber() as YaoType,
        diZhi,
        tianGan: yaoData.tianGan?.toNumber() as TianGan | undefined,
        wuXing,
        liuQin: yaoData.liuQin.toNumber() as LiuQin,
        liuShen: yaoData.liuShen.toNumber() as LiuShen,
        isShi: yaoData.isShi.isTrue,
        isYing: yaoData.isYing.isTrue,
        isDong: false, // 需要从 movingYaos 位图判断
        wangShuai,
        riChenGuanXi,
        isXunKong,
        shenShaList: [], // 稍后填充
      });
    }

    // 解析动爻位图和变爻信息
    const movingYaos = data.movingYaos.toNumber();
    for (let i = 0; i < 6; i++) {
      if ((movingYaos & (1 << i)) !== 0) {
        yaos[i].isDong = true;
        // 如果有变卦，设置变爻信息
        if (data.hasBianGua.isTrue) {
          const changedYao = data.changedYaos[i];
          const bianDiZhi = changedYao.diZhi.toNumber() as DiZhi;
          const bianWuXing = changedYao.wuXing.toNumber() as WuXing;
          yaos[i].bianDiZhi = bianDiZhi;
          yaos[i].bianWuXing = bianWuXing;
          yaos[i].bianLiuQin = changedYao.liuQin.toNumber() as LiuQin;
          // 计算回头生克
          yaos[i].huiTouZuoYong = calculateHuiTouLocal(yaos[i].wuXing, bianWuXing);
        }
      }
    }

    // 计算神煞信息
    const shenShaInfo = calculateShenShaInfoLocal(riGan, riChen, yueJian);

    // 为每个爻填充神煞列表
    for (let i = 0; i < 6; i++) {
      yaos[i].shenShaList = getShenShaForZhiLocal(shenShaInfo, yaos[i].diZhi);
    }

    // 解析问题 CID
    let questionHash: string | undefined;
    if (data.questionCid && data.questionCid.isSome) {
      const cidBytes = data.questionCid.unwrap();
      questionHash = new TextDecoder().decode(new Uint8Array(cidBytes));
    }

    // 获取卦名
    const benGuaIndex = data.originalNameIdx.toNumber();
    const benGuaName = GUA_NAMES[benGuaIndex] || `卦${benGuaIndex}`;
    let bianGuaIndex: number | undefined;
    let bianGuaName: string | undefined;
    if (data.hasBianGua.isTrue) {
      bianGuaIndex = data.changedNameIdx.toNumber();
      bianGuaName = GUA_NAMES[bianGuaIndex] || `卦${bianGuaIndex}`;
    }

    // 计算互卦索引（如果pallet有返回则使用，否则本地计算）
    let huGuaIndex: number | undefined;
    let huGuaName: string | undefined;
    if (data.huGuaIdx) {
      huGuaIndex = data.huGuaIdx.toNumber();
      huGuaName = GUA_NAMES[huGuaIndex] || `卦${huGuaIndex}`;
    }

    // 判断六冲六合
    const isLiuChong = checkLiuChongLocal(benGuaIndex);
    const isLiuHe = checkLiuHeLocal(benGuaIndex);

    // 判断反吟伏吟
    let isFanYin = false;
    let isFuYin = false;
    if (data.hasBianGua.isTrue && bianGuaIndex !== undefined) {
      isFanYin = checkFanYinLocal(benGuaIndex, bianGuaIndex);
      isFuYin = benGuaIndex === bianGuaIndex;
    }

    // 获取卦宫五行
    const gongWuXing = data.gongWuXing?.toNumber() as WuXing | undefined;

    // 获取卦身
    let guaShen: DiZhi | undefined;
    if (data.guaShen) {
      guaShen = data.guaShen.toNumber() as DiZhi;
    }

    const gua: LiuyaoGua = {
      id: guaId,
      creator: data.creator.toString(),
      benGuaIndex,
      benGuaName,
      bianGuaIndex,
      bianGuaName,
      huGuaIndex,
      huGuaName,
      yaos,
      riGan,
      riChen,
      yueJian,
      gongWuXing,
      guaShen,
      xunKong,
      isLiuChong,
      isLiuHe,
      isFanYin,
      isFuYin,
      shenShaInfo,
      questionHash,
      divinationTime: Date.now(),
      createdAt: data.createdAt.toNumber(),
      isPublic: data.isPublic.isTrue,
    };

    console.log('[getGua] 解析成功:', gua);
    return gua;
  } catch (error) {
    console.error('[getGua] 解析失败:', error);
    return null;
  }
}

/**
 * 获取用户的卦象列表
 *
 * @param address - 用户地址
 * @returns 卦象 ID 列表
 */
export async function getUserGuas(address: string): Promise<number[]> {
  const api = await getApi();

  if (!api.query.liuyao || !api.query.liuyao.userGuas) {
    console.error('[getUserGuas] liuyao pallet 不存在');
    return [];
  }

  const result = await api.query.liuyao.userGuas(address);
  return result.map((id: { toNumber: () => number }) => id.toNumber());
}

/**
 * 获取公开卦象列表
 *
 * @returns 公开卦象 ID 列表
 */
export async function getPublicGuas(): Promise<number[]> {
  const api = await getApi();

  if (!api.query.liuyao || !api.query.liuyao.publicGuas) {
    console.error('[getPublicGuas] liuyao pallet 不存在');
    return [];
  }

  const result = await api.query.liuyao.publicGuas();
  return result.map((id: { toNumber: () => number }) => id.toNumber());
}

/**
 * 获取用户统计数据
 *
 * @param address - 用户地址
 * @returns 用户统计
 */
export async function getUserStats(address: string): Promise<{
  totalGuas: number;
  aiInterpretations: number;
  firstGuaBlock: number;
} | null> {
  const api = await getApi();

  if (!api.query.liuyao || !api.query.liuyao.userStats) {
    return null;
  }

  const result = await api.query.liuyao.userStats(address);
  if (!result) return null;

  return {
    totalGuas: result.totalGuas.toNumber(),
    aiInterpretations: result.aiInterpretations.toNumber(),
    firstGuaBlock: result.firstGuaBlock.toNumber(),
  };
}

// ==================== 卦象管理服务 ====================

/**
 * 设置卦象公开状态
 *
 * @param guaId - 卦象 ID
 * @param isPublic - 是否公开
 */
export async function setGuaVisibility(guaId: number, isPublic: boolean): Promise<void> {
  const api = await getSignedApi();

  if (!api.tx.liuyao || !api.tx.liuyao.setGuaVisibility) {
    throw new Error('区块链节点未包含六爻模块（pallet-liuyao），请检查节点配置');
  }

  const tx = api.tx.liuyao.setGuaVisibility(guaId, isPublic);

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, dispatchError }) => {
      if (dispatchError) {
        if (dispatchError.isModule) {
          const decoded = api.registry.findMetaError(dispatchError.asModule);
          const { docs, name, section } = decoded;
          reject(new Error(`${section}.${name}: ${docs.join(' ')}`));
        } else {
          reject(new Error(dispatchError.toString()));
        }
        return;
      }

      if (status.isInBlock || status.isFinalized) {
        console.log('[setGuaVisibility] 设置成功');
        resolve();
      }
    }).catch((error) => {
      console.error('[setGuaVisibility] 设置失败:', error);
      reject(error);
    });
  });
}

// ==================== AI 解读服务（已废弃，使用 pallet-divination-ai） ====================

/**
 * 请求 AI 解读
 *
 * @deprecated 请使用 pallet_divination_ai::request_interpretation
 * @param guaId - 卦象 ID
 */
export async function requestAiInterpretation(guaId: number): Promise<void> {
  const api = await getSignedApi();

  if (!api.tx.liuyao || !api.tx.liuyao.requestAiInterpretation) {
    throw new Error('区块链节点未包含六爻模块（pallet-liuyao），请检查节点配置');
  }

  const tx = api.tx.liuyao.requestAiInterpretation(guaId);

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, dispatchError }) => {
      if (dispatchError) {
        if (dispatchError.isModule) {
          const decoded = api.registry.findMetaError(dispatchError.asModule);
          const { docs, name, section } = decoded;
          reject(new Error(`${section}.${name}: ${docs.join(' ')}`));
        } else {
          reject(new Error(dispatchError.toString()));
        }
        return;
      }

      if (status.isInBlock || status.isFinalized) {
        console.log('[requestAiInterpretation] 请求成功');
        resolve();
      }
    }).catch((error) => {
      console.error('[requestAiInterpretation] 请求失败:', error);
      reject(error);
    });
  });
}

// ==================== 批量查询服务 ====================

/**
 * 批量获取卦象详情
 *
 * @param guaIds - 卦象 ID 列表
 * @returns 卦象数据列表
 */
export async function getGuasBatch(guaIds: number[]): Promise<LiuyaoGua[]> {
  const results = await Promise.all(guaIds.map((id) => getGua(id)));
  return results.filter((gua): gua is LiuyaoGua => gua !== null);
}

/**
 * 获取用户的所有卦象详情
 *
 * @param address - 用户地址
 * @returns 卦象数据列表
 */
export async function getUserGuasWithDetails(address: string): Promise<LiuyaoGua[]> {
  const guaIds = await getUserGuas(address);
  return getGuasBatch(guaIds);
}

/**
 * 获取公开卦象详情（分页）
 *
 * @param page - 页码（从 0 开始）
 * @param pageSize - 每页数量
 * @returns 卦象数据列表和总数
 */
export async function getPublicGuasWithDetails(
  page: number = 0,
  pageSize: number = 10
): Promise<{ guas: LiuyaoGua[]; total: number }> {
  const allIds = await getPublicGuas();
  const total = allIds.length;
  const start = page * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageIds = allIds.slice(start, end);
  const guas = await getGuasBatch(pageIds);
  return { guas, total };
}

// ==================== 干支计算辅助函数 ====================

/**
 * 天干名称
 */
export const TIAN_GAN_NAMES = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

/**
 * 地支名称
 */
export const DI_ZHI_NAMES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

/**
 * 获取干支字符串
 */
export function getGanZhiString(gz: GanZhi): string {
  return TIAN_GAN_NAMES[gz[0]] + DI_ZHI_NAMES[gz[1]];
}

/**
 * 从日期获取简化的干支（需要完整的历法库才能精确计算）
 * 这里提供一个简化版本，实际应用中应使用专业历法库
 */
export function getGanZhiFromDate(date: Date): {
  year: GanZhi;
  month: GanZhi;
  day: GanZhi;
  hour: GanZhi;
} {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();

  // 简化计算（实际需要使用完整的历法算法）
  // 年干支
  const yearOffset = (year - 4) % 60;
  const yearGan = yearOffset % 10;
  const yearZhi = yearOffset % 12;

  // 月干支（简化，实际需要考虑节气）
  const monthGan = (yearGan * 2 + month) % 10;
  const monthZhi = (month + 1) % 12;

  // 日干支（简化，实际需要查表）
  const baseDate = new Date(1900, 0, 31); // 基准日：1900年1月31日 甲子日
  const diffDays = Math.floor((date.getTime() - baseDate.getTime()) / 86400000);
  const dayGan = diffDays % 10;
  const dayZhi = diffDays % 12;

  // 时干支
  const hourZhi = Math.floor((hour + 1) / 2) % 12;
  const hourGan = (dayGan * 2 + Math.floor(hourZhi / 2)) % 10;

  return {
    year: [yearGan, yearZhi],
    month: [monthGan, monthZhi],
    day: [dayGan >= 0 ? dayGan : dayGan + 10, dayZhi >= 0 ? dayZhi : dayZhi + 12],
    hour: [hourGan, hourZhi],
  };
}
