#!/usr/bin/env node

/**
 * 函数级详细中文注释：检查链上可用的Extrinsics
 */

const { ApiPromise, WsProvider } = require('@polkadot/api');

async function checkAvailableExtrinsics() {
  console.log('🔗 正在连接到Substrate节点...');

  const wsEndpoint = process.env.WS_ENDPOINT || 'ws://127.0.0.1:9944';
  const provider = new WsProvider(wsEndpoint);

  try {
    const api = await ApiPromise.create({ provider });
    console.log(`✅ 已连接到链：${await api.rpc.system.chain()}`);

    console.log('\n📋 检查可用的pallets...');

    // 检查是否有deceased pallet
    if (api.tx.deceased) {
      console.log('✅ deceased pallet 可用');
      console.log('📋 deceased pallet 的 extrinsics:');
      Object.keys(api.tx.deceased).forEach(method => {
        console.log(`  - ${method}`);
      });
    } else {
      console.log('❌ deceased pallet 不可用');
    }

    console.log('\n📋 所有可用的pallets:');
    Object.keys(api.tx).forEach(pallet => {
      console.log(`  - ${pallet}`);
    });

  } catch (error) {
    console.error('❌ 连接失败：', error.message);
  } finally {
    process.exit(0);
  }
}

checkAvailableExtrinsics().catch(console.error);