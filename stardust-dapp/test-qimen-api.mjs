/**
 * 测试奇门遁甲 Runtime API
 */

import { ApiPromise, WsProvider } from '@polkadot/api';

async function testQimenAPI() {
  console.log('🔗 连接到本地节点...');
  const wsProvider = new WsProvider('ws://localhost:9944');
  const api = await ApiPromise.create({ provider: wsProvider });

  console.log('✅ 已连接到节点');
  console.log('Runtime version:', api.runtimeVersion.toHuman());

  // 检查 qimen pallet 是否存在
  if (!api.query.qimen) {
    console.error('❌ qimen pallet 不存在');
    process.exit(1);
  }
  console.log('✅ qimen pallet 存在');

  // 检查 Runtime API 是否存在
  if (!api.call || !api.call.qimenInterpretationApi) {
    console.error('❌ qimenInterpretationApi Runtime API 不存在');
    console.log('可用的 Runtime APIs:', Object.keys(api.call || {}));
    process.exit(1);
  }
  console.log('✅ qimenInterpretationApi Runtime API 存在');

  // 检查具体方法
  const methods = Object.keys(api.call.qimenInterpretationApi);
  console.log('可用的解卦方法:', methods);

  // 测试查询一个排盘（假设 ID 为 0）
  try {
    console.log('\n📊 测试查询排盘 ID: 0');
    const chart = await api.query.qimen.charts(0);

    if (chart.isNone) {
      console.log('⚠️  排盘 ID 0 不存在，跳过解卦测试');
    } else {
      console.log('✅ 找到排盘 ID 0');
      console.log('排盘信息:', chart.toHuman());

      // 测试核心解卦
      console.log('\n🔮 测试核心解卦 API...');
      const coreResult = await api.call.qimenInterpretationApi.getCoreInterpretation(0);

      if (coreResult.isNone) {
        console.log('❌ 核心解卦返回 None');
      } else {
        console.log('✅ 核心解卦成功');
        console.log('核心解卦结果:', coreResult.toHuman());
      }

      // 测试完整解卦
      console.log('\n🎯 测试完整解卦 API...');
      const fullResult = await api.call.qimenInterpretationApi.getFullInterpretation(0, 0); // QuestionType::General = 0

      if (fullResult.isNone) {
        console.log('❌ 完整解卦返回 None');
      } else {
        console.log('✅ 完整解卦成功');
        const interpretation = fullResult.toJSON();
        console.log('完整解卦结果:');
        console.log('- core:', interpretation.core ? '✓' : '✗');
        console.log('- palaces:', interpretation.palaces ? `✓ (${interpretation.palaces.length} 个宫位)` : '✗');
        console.log('- yongShen:', interpretation.yongShen ? '✓' : '✗');
        console.log('- yingQi:', interpretation.yingQi ? '✓' : '✗');
        console.log('- geJuDetail:', interpretation.geJuDetail ? '✓' : '✗');
      }
    }
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error(error);
  }

  await api.disconnect();
  console.log('\n🔌 已断开连接');
}

testQimenAPI().catch(console.error);
