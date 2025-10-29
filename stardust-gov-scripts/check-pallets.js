#!/usr/bin/env node

/**
 * 检查链上可用的 pallets
 */

const { ApiPromise, WsProvider } = require('@polkadot/api');

async function main() {
  console.log('🔍 检查链上可用的 Pallets...\n');
  
  const api = await ApiPromise.create({ 
    provider: new WsProvider('ws://127.0.0.1:9944') 
  });
  
  console.log('✅ 已连接\n');
  
  // 获取所有可用的 tx pallets
  console.log('📦 可用的 Transaction Pallets:');
  console.log('='.repeat(60));
  
  const txPallets = Object.keys(api.tx).sort();
  txPallets.forEach((pallet, index) => {
    console.log(`${(index + 1).toString().padStart(3)}. ${pallet}`);
  });
  
  console.log('\n' + '='.repeat(60));
  console.log(`总计: ${txPallets.length} 个 pallets\n`);
  
  // 搜索包含 'offering' 的 pallet
  console.log('🔍 搜索 offering 相关的 pallet:');
  const offeringPallets = txPallets.filter(p => 
    p.toLowerCase().includes('offering')
  );
  
  if (offeringPallets.length > 0) {
    console.log('✅ 找到:');
    offeringPallets.forEach(p => {
      console.log(`   - ${p}`);
      
      // 显示该 pallet 的方法
      const methods = Object.keys(api.tx[p]);
      console.log(`     方法: ${methods.join(', ')}`);
    });
  } else {
    console.log('❌ 未找到 offering 相关的 pallet');
    
    // 搜索其他可能的名称
    console.log('\n💡 搜索其他可能的名称:');
    const possibleNames = ['memo', 'grave', 'park'];
    
    possibleNames.forEach(name => {
      const matches = txPallets.filter(p => 
        p.toLowerCase().includes(name.toLowerCase())
      );
      if (matches.length > 0) {
        console.log(`\n   ${name.toUpperCase()} 相关:`);
        matches.forEach(p => console.log(`     - ${p}`));
      }
    });
  }
  
  await api.disconnect();
}

main().catch(error => {
  console.error('❌ 错误:', error.message);
  process.exit(1);
});

