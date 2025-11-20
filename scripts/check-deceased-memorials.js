#!/usr/bin/env node

/**
 * 函数级详细中文注释：检查链上所有逝者纪念馆
 *
 * 功能：
 * - 连接到Substrate链节点
 * - 查询所有逝者数据
 * - 分析逝者分类分布
 * - 验证公众纪念馆过滤逻辑
 */

const { ApiPromise, WsProvider } = require('@polkadot/api');

// 逝者分类枚举（与前端保持一致）
const DeceasedCategory = {
  Ordinary: 0,         // 普通民众
  HistoricalFigure: 1, // 历史人物
  Martyr: 2,           // 革命烈士
  Hero: 3,             // 英雄模范
  PublicFigure: 4,     // 公众人物
  ReligiousFigure: 5,  // 宗教人物
  EventHall: 6,        // 事件馆
};

// 分类名称映射
const categoryNames = {
  [DeceasedCategory.Ordinary]: '普通民众',
  [DeceasedCategory.HistoricalFigure]: '历史人物',
  [DeceasedCategory.Martyr]: '革命烈士',
  [DeceasedCategory.Hero]: '英雄模范',
  [DeceasedCategory.PublicFigure]: '公众人物',
  [DeceasedCategory.ReligiousFigure]: '宗教人物',
  [DeceasedCategory.EventHall]: '事件馆',
};

/**
 * 函数级详细中文注释：解码字符串（BoundedVec<u8>）
 */
function decodeString(bounded) {
  try {
    return new TextDecoder().decode(new Uint8Array(bounded));
  } catch {
    return '';
  }
}

/**
 * 函数级详细中文注释：解码逝者分类枚举
 */
function decodeCategory(category) {
  if (category.isOrdinary) return DeceasedCategory.Ordinary;
  if (category.isHistoricalFigure) return DeceasedCategory.HistoricalFigure;
  if (category.isMartyr) return DeceasedCategory.Martyr;
  if (category.isHero) return DeceasedCategory.Hero;
  if (category.isPublicFigure) return DeceasedCategory.PublicFigure;
  if (category.isReligiousFigure) return DeceasedCategory.ReligiousFigure;
  if (category.isEventHall) return DeceasedCategory.EventHall;
  // 默认为普通民众
  return DeceasedCategory.Ordinary;
}

/**
 * 函数级详细中文注释：检查链上逝者数据
 */
async function checkDeceasedMemorials() {
  console.log('🔗 正在连接到Substrate节点...');

  const wsEndpoint = process.env.WS_ENDPOINT || 'ws://127.0.0.1:9944';
  const provider = new WsProvider(wsEndpoint);

  try {
    const api = await ApiPromise.create({ provider });
    console.log(`✅ 已连接到链：${await api.rpc.system.chain()}`);
    console.log(`📊 当前区块高度：${await api.rpc.chain.getHeader()}`);

    // 查询所有逝者数据
    console.log('\n📋 正在查询所有逝者数据...');
    const entries = await api.query.deceased.deceasedOf.entries();

    if (entries.length === 0) {
      console.log('❌ 链上暂无逝者数据');
      process.exit(0);
    }

    console.log(`📊 找到 ${entries.length} 个逝者记录`);

    // 统计数据
    const stats = {
      total: 0,
      byCategory: {},
      publicMemorials: [], // 非普通民众（应显示在公众纪念馆）
      privateMemorials: [], // 普通民众（不应显示在公众纪念馆）
    };

    // 初始化分类统计
    Object.values(DeceasedCategory).forEach(cat => {
      if (typeof cat === 'number') {
        stats.byCategory[cat] = 0;
      }
    });

    console.log('\n📋 逝者详细列表：');
    console.log('─'.repeat(80));

    for (const [key, value] of entries) {
      if (value.isNone) continue;

      const id = key.args[0].toNumber();
      const data = value.unwrap();

      // 查询分类信息
      const categoryResult = await api.query.deceased.categoryOf(id);
      const category = decodeCategory(categoryResult);

      const deceased = {
        id,
        fullName: decodeString(data.fullName),
        owner: data.owner.toString(),
        creator: data.creator.toString(),
        birthDate: new Date(data.birthDate.toNumber()).toLocaleDateString(),
        deathDate: new Date(data.deathDate.toNumber()).toLocaleDateString(),
        bio: decodeString(data.bio),
        category,
        categoryName: categoryNames[category],
        createdAt: new Date(data.createdAt.toNumber()).toLocaleString(),
      };

      // 输出逝者信息
      console.log(`ID: ${deceased.id} | ${deceased.fullName} | ${deceased.categoryName}`);
      console.log(`  生卒: ${deceased.birthDate} - ${deceased.deathDate}`);
      console.log(`  简介: ${deceased.bio.substring(0, 50)}${deceased.bio.length > 50 ? '...' : ''}`);
      console.log(`  创建者: ${deceased.creator}`);
      console.log(`  创建时间: ${deceased.createdAt}`);
      console.log('─'.repeat(80));

      // 统计
      stats.total++;
      stats.byCategory[category]++;

      // 分类：公众纪念馆 vs 私人纪念馆
      if (category === DeceasedCategory.Ordinary) {
        stats.privateMemorials.push(deceased);
      } else {
        stats.publicMemorials.push(deceased);
      }
    }

    // 输出统计结果
    console.log('\n📊 统计结果：');
    console.log('═'.repeat(80));
    console.log(`📈 总计: ${stats.total} 个逝者记录`);
    console.log('\n📋 按分类统计：');

    Object.entries(stats.byCategory).forEach(([catNum, count]) => {
      const catName = categoryNames[parseInt(catNum)];
      const percentage = ((count / stats.total) * 100).toFixed(1);
      const isPublic = parseInt(catNum) !== DeceasedCategory.Ordinary;
      const icon = isPublic ? '🌟' : '👤';
      console.log(`  ${icon} ${catName}: ${count} 个 (${percentage}%)`);
    });

    console.log('\n🏛️ 公众纪念馆过滤结果：');
    console.log(`✅ 应显示: ${stats.publicMemorials.length} 个（非普通民众）`);
    console.log(`❌ 不显示: ${stats.privateMemorials.length} 个（普通民众）`);

    if (stats.publicMemorials.length > 0) {
      console.log('\n🌟 公众纪念馆列表（应在前端显示）：');
      stats.publicMemorials.forEach((memorial, index) => {
        console.log(`  ${index + 1}. ${memorial.fullName} - ${memorial.categoryName}`);
      });
    }

    if (stats.privateMemorials.length > 0) {
      console.log('\n👤 私人纪念馆列表（前端过滤掉）：');
      stats.privateMemorials.forEach((memorial, index) => {
        console.log(`  ${index + 1}. ${memorial.fullName} - ${memorial.categoryName}`);
      });
    }

    console.log('\n✅ 检查完成！');

  } catch (error) {
    console.error('❌ 连接失败：', error.message);
    console.log('\n💡 可能原因：');
    console.log('  1. Substrate节点未启动');
    console.log('  2. 连接地址错误');
    console.log('  3. 网络连接问题');
    console.log('\n🔧 解决方案：');
    console.log('  1. 启动链节点：./target/release/solochain-template-node --dev');
    console.log('  2. 检查端口是否正确：ws://127.0.0.1:9944');
    console.log('  3. 或设置环境变量：WS_ENDPOINT=ws://your-node:9944');
  } finally {
    process.exit(0);
  }
}

// 运行检查
checkDeceasedMemorials().catch(console.error);