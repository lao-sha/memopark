#!/usr/bin/env node

/**
 * 测试查询链上逝者数据和分类
 */

const { ApiPromise, WsProvider } = require('@polkadot/api');

async function testQuery() {
  console.log('🔗 正在连接到Substrate节点...');

  const wsEndpoint = 'ws://127.0.0.1:9944';
  const provider = new WsProvider(wsEndpoint);

  try {
    const api = await ApiPromise.create({ provider });
    console.log(`✅ 已连接到链：${await api.rpc.system.chain()}`);

    // 查询所有逝者
    const entries = await api.query.deceased.deceasedOf.entries();
    console.log(`\n📊 链上逝者总数: ${entries.length}`);

    if (entries.length === 0) {
      console.log('❌ 链上暂无逝者数据，请先运行 create-test-deceased.js 创建测试数据');
      process.exit(1);
    }

    console.log('\n📋 逝者列表：');
    console.log('═'.repeat(100));

    for (const [key, value] of entries) {
      if (value.isNone) continue;

      const id = key.args[0].toNumber();
      const data = value.unwrap();
      const fullName = new TextDecoder().decode(new Uint8Array(data.fullName));

      // 查询分类
      const categoryResult = await api.query.deceased.categoryOf(id);
      console.log(`\nID: ${id}`);
      console.log(`姓名: ${fullName}`);
      console.log(`分类对象:`, categoryResult.toJSON());
      console.log(`isOrdinary: ${categoryResult.isOrdinary}`);
      console.log(`isHistoricalFigure: ${categoryResult.isHistoricalFigure}`);
      console.log(`isMartyr: ${categoryResult.isMartyr}`);
      console.log(`isHero: ${categoryResult.isHero}`);

      // 解码分类
      let category = 'Unknown';
      if (categoryResult.isOrdinary) category = 'Ordinary';
      else if (categoryResult.isHistoricalFigure) category = 'HistoricalFigure';
      else if (categoryResult.isMartyr) category = 'Martyr';
      else if (categoryResult.isHero) category = 'Hero';
      else if (categoryResult.isPublicFigure) category = 'PublicFigure';
      else if (categoryResult.isReligiousFigure) category = 'ReligiousFigure';
      else if (categoryResult.isEventHall) category = 'EventHall';

      console.log(`解码后分类: ${category}`);
      console.log('─'.repeat(100));
    }

    console.log('\n✅ 查询完成');

  } catch (error) {
    console.error('❌ 查询失败：', error.message);
  } finally {
    process.exit(0);
  }
}

testQuery().catch(console.error);
