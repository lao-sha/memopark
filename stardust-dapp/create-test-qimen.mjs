/**
 * 创建测试奇门遁甲排盘
 */

import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';

async function createTestChart() {
  console.log('🔗 连接到本地节点...');
  const wsProvider = new WsProvider('ws://localhost:9944');
  const api = await ApiPromise.create({ provider: wsProvider });

  console.log('✅ 已连接到节点');

  // 创建测试账户
  const keyring = new Keyring({ type: 'sr25519' });
  const alice = keyring.addFromUri('//Alice');

  console.log('👤 使用账户:', alice.address);

  try {
    // 使用随机起局方法创建排盘
    console.log('\n🎲 创建随机奇门遁甲排盘...');

    const questionHash = new Array(32).fill(0); // 空的问题哈希
    const isPublic = true; // 公开排盘

    const tx = api.tx.qimen.divineRandom(questionHash, isPublic);

    await new Promise((resolve, reject) => {
      tx.signAndSend(alice, ({ status, events, dispatchError }) => {
        console.log('交易状态:', status.type);

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
          const chartCreatedEvent = events.find((e) =>
            e.event.section === 'qimen' && e.event.method === 'ChartCreated'
          );

          if (chartCreatedEvent) {
            const chartId = chartCreatedEvent.event.data[0].toNumber();
            console.log('✅ 排盘创建成功！');
            console.log('📋 排盘 ID:', chartId);

            // 查询排盘详情
            api.query.qimen.charts(chartId).then((chart) => {
              console.log('\n📊 排盘详情:');
              console.log(chart.toHuman());
              resolve(chartId);
            });
          } else if (status.isFinalized) {
            reject(new Error('交易成功但未找到排盘创建事件'));
          }
        }
      }).catch((error) => {
        console.error('交易失败:', error);
        reject(error);
      });
    });
  } catch (error) {
    console.error('❌ 创建排盘失败:', error.message);
    console.error(error);
  }

  await api.disconnect();
  console.log('\n🔌 已断开连接');
}

createTestChart().catch(console.error);
