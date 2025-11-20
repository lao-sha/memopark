#!/usr/bin/env node

/**
 * 函数级详细中文注释：简化的逝者数据检查
 */

const { ApiPromise, WsProvider } = require('@polkadot/api');

async function simpleCheck() {
  const wsEndpoint = 'ws://127.0.0.1:9944';
  const provider = new WsProvider(wsEndpoint);

  try {
    const api = await ApiPromise.create({ provider });
    console.log('✅ 连接成功');

    // 简单查询
    const entries = await api.query.deceased.deceasedOf.entries();
    console.log(`📊 找到 ${entries.length} 个逝者记录`);

    if (entries.length > 0) {
      console.log('🎉 成功！有逝者数据，现在前端可以显示真实数据了');
      console.log('🔗 访问：http://localhost:5175/#/memorial');
    }

  } catch (error) {
    console.error('❌ 错误：', error.message);
  } finally {
    process.exit(0);
  }
}

simpleCheck().catch(console.error);