/**
 * 函数级详细中文注释：供奉品配置文件
 * 
 * 用途：
 * - 前端供奉品数据配置
 * - 从云上思念网站提取的数据
 * - 包含图片URL、价格、分类等信息
 * 
 * 数据来源：
 * - 云上思念网站 (https://m.yssn.cn)
 * - 提取日期：2025-11-08
 * - 总供奉品数：541 个
 */

/**
 * 函数级详细中文注释：供奉品类别枚举
 */
export enum OfferingCategory {
  CANDLE = 'xiangzhu',      // 香烛
  FLOWER = 'huaguo',        // 花果
  FOOD = 'jiucai',          // 酒菜
  HOME = 'jiajuqiche',      // 家居汽车
  VILLA = 'bieshuyongren',  // 别墅佣人
  FASHION = 'fushimingbiao', // 服饰名表
  DIGITAL = 'shumayueqi',   // 数码乐器
  FESTIVAL = 'jieri',       // 节日
  TOY = 'wanjuchongwu',     // 玩具宠物
  SPORTS = 'yundong',       // 运动
  PACKAGE = 'taocan'        // 套餐
}

/**
 * 函数级详细中文注释：供奉品接口定义
 */
export interface OfferingItem {
  /** 索引 */
  index: number;
  /** 名称 */
  name: string;
  /** 价格（元） */
  price: number;
  /** 图片URL */
  imageUrl: string;
  /** IPFS CID（可选，需要上传后填充） */
  ipfsCid?: string;
  /** 类别 */
  category?: OfferingCategory;
  /** Emoji 图标（可选） */
  icon?: string;
}

/**
 * 函数级详细中文注释：类别信息接口
 */
export interface CategoryInfo {
  code: OfferingCategory;
  name: string;
  icon: string;
  description: string;
}

/**
 * 函数级详细中文注释：类别信息列表
 */
export const CATEGORIES: CategoryInfo[] = [
  {
    code: OfferingCategory.PACKAGE,
    name: '套餐',
    icon: '🎁',
    description: '精选供奉套餐组合'
  },
  {
    code: OfferingCategory.CANDLE,
    name: '香烛',
    icon: '🕯️',
    description: '蜡烛、香火等祭祀用品'
  },
  {
    code: OfferingCategory.FLOWER,
    name: '花果',
    icon: '🌸',
    description: '鲜花、水果等供品'
  },
  {
    code: OfferingCategory.FOOD,
    name: '酒菜',
    icon: '🍷',
    description: '酒水、菜肴等食品'
  },
  {
    code: OfferingCategory.HOME,
    name: '家居汽车',
    icon: '🏠',
    description: '家用电器、汽车等物品'
  },
  {
    code: OfferingCategory.VILLA,
    name: '别墅佣人',
    icon: '🏰',
    description: '房产、佣人等'
  },
  {
    code: OfferingCategory.FASHION,
    name: '服饰名表',
    icon: '👔',
    description: '服装、手表等配饰'
  },
  {
    code: OfferingCategory.DIGITAL,
    name: '数码乐器',
    icon: '📱',
    description: '电子产品、乐器等'
  },
  {
    code: OfferingCategory.FESTIVAL,
    name: '节日',
    icon: '🎉',
    description: '节日特色供品'
  },
  {
    code: OfferingCategory.TOY,
    name: '玩具宠物',
    icon: '🧸',
    description: '玩具、宠物等'
  },
  {
    code: OfferingCategory.SPORTS,
    name: '运动',
    icon: '⚽',
    description: '运动器材、体育用品'
  }
];

/**
 * 函数级详细中文注释：精选供奉品列表（适用于快捷选择）
 * 从 541 个供奉品中精选常用的供品
 */
export const FEATURED_OFFERINGS: OfferingItem[] = [
  {
    index: 34,
    name: '蜡烛',
    price: 0,
    imageUrl: 'http://static.yunmuyuan.net//ymy/uploads/20220831/875fbd27520af04c3065e786113cb72b.png',
    category: OfferingCategory.CANDLE,
    icon: '🕯️'
  },
  {
    index: 35,
    name: '鲜花',
    price: 0,
    imageUrl: 'http://static.yunmuyuan.net//ymy/uploads/20211105/b250937060ffb06b7fa1660d62cd8c96.png',
    category: OfferingCategory.FLOWER,
    icon: '🌸'
  },
  {
    index: 62,
    name: '富贵香',
    price: 3,
    imageUrl: 'http://static.yunmuyuan.net//ymy/uploads/20220114/1776999cb7e9d5db1e8d846192949437.png',
    category: OfferingCategory.CANDLE,
    icon: '🪔'
  },
  {
    index: 182,
    name: '相思烛',
    price: 2,
    imageUrl: 'http://static.yssn.cn//ymy/uploads/20240514/bac9de22645bfda0a7da652aafed4ca6.png',
    category: OfferingCategory.CANDLE,
    icon: '🕯️'
  },
  {
    index: 37,
    name: '一篮水果',
    price: 8,
    imageUrl: 'http://static.yssn.cn//ymy/uploads/20240514/15e4c773dc4641aaecb34112ed7d103a.png',
    category: OfferingCategory.FLOWER,
    icon: '🧺'
  },
  {
    index: 51,
    name: '感念亲恩',
    price: 3,
    imageUrl: 'http://static.yunmuyuan.net//ymy/uploads/20230111/f379a602b011f66b9987a9f79dbaf729.png',
    category: OfferingCategory.FLOWER,
    icon: '💐'
  },
  {
    index: 435,
    name: '99朵玫瑰',
    price: 9,
    imageUrl: 'http://static.yunmuyuan.net//ymy/uploads/20220210/0c24ac2cb81013d6b4c5b56ff59845a9.png',
    category: OfferingCategory.FLOWER,
    icon: '🌹'
  },
  {
    index: 111,
    name: '雄黄酒',
    price: 3,
    imageUrl: 'http://static.yunmuyuan.net//ymy/uploads/20210607/269a99059a6a86782679cb9f53dcc4d8.png',
    category: OfferingCategory.FOOD,
    icon: '🍶'
  },
  {
    index: 149,
    name: '五仁月饼',
    price: 3,
    imageUrl: 'http://static.yunmuyuan.net//ymy/uploads/20220908/770ffa4dfc5935add3c1f76830763315.png',
    category: OfferingCategory.FESTIVAL,
    icon: '🥮'
  },
  {
    index: 494,
    name: '富贵圆满',
    price: 6,
    imageUrl: 'http://static.yunmuyuan.net//ymy/uploads/20230107/bf841b35d0aae42b133c14969fa529f1.png',
    category: OfferingCategory.PACKAGE,
    icon: '🎁'
  }
];

/**
 * 函数级详细中文注释：根据类别获取供奉品
 * @param category 类别代码
 * @returns 该类别的供奉品列表
 * 
 * 注意：完整的供奉品列表需要从 offerings-with-images.json 加载
 * 或者通过 API 从链端查询
 */
export function getOfferingsByCategory(category: OfferingCategory): OfferingItem[] {
  return FEATURED_OFFERINGS.filter(item => item.category === category);
}

/**
 * 函数级详细中文注释：根据名称搜索供奉品
 * @param keyword 关键词
 * @returns 匹配的供奉品列表
 */
export function searchOfferings(keyword: string): OfferingItem[] {
  const lowerKeyword = keyword.toLowerCase();
  return FEATURED_OFFERINGS.filter(item => 
    item.name.toLowerCase().includes(lowerKeyword)
  );
}

/**
 * 函数级详细中文注释：获取免费供奉品
 * @returns 免费供奉品列表
 */
export function getFreeOfferings(): OfferingItem[] {
  return FEATURED_OFFERINGS.filter(item => item.price === 0);
}

/**
 * 函数级详细中文注释：获取推荐供奉品（价格适中，常用）
 * @returns 推荐供奉品列表
 */
export function getRecommendedOfferings(): OfferingItem[] {
  return FEATURED_OFFERINGS.filter(item => 
    item.price > 0 && item.price <= 5
  ).slice(0, 6);
}

/**
 * 函数级详细中文注释：格式化价格显示
 * @param price 价格（元）
 * @returns 格式化后的价格字符串
 */
export function formatPrice(price: number): string {
  if (price === 0) {
    return '免费';
  }
  return `${price} DUST`;
}

/**
 * 函数级详细中文注释：获取类别信息
 * @param category 类别代码
 * @returns 类别信息
 */
export function getCategoryInfo(category: OfferingCategory): CategoryInfo | undefined {
  return CATEGORIES.find(cat => cat.code === category);
}

