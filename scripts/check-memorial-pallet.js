const { ApiPromise, WsProvider } = require('@polkadot/api');

async function main() {
  const wsProvider = new WsProvider('ws://127.0.0.1:9944');
  const api = await ApiPromise.create({ provider: wsProvider });
  
  console.log('🔍 检查 Memorial Pallet 接口:\n');
  
  // 列出所有可用的 pallet
  console.log('📦 可用的 Pallets:');
  const pallets = Object.keys(api.query).sort();
  pallets.forEach(p => console.log(`   - ${p}`));
  
  console.log('\n🔧 Memorial Pallet 的存储项:');
  if (api.query.memorial) {
    const storages = Object.keys(api.query.memorial).sort();
    storages.forEach(s => console.log(`   - ${s}`));
  } else {
    console.log('   ❌ Memorial pallet 不存在！');
  }
  
  console.log('\n🔧 Memorial Pallet 的可调用函数:');
  if (api.tx.memorial) {
    const extrinsics = Object.keys(api.tx.memorial).sort();
    extrinsics.forEach(e => console.log(`   - ${e}`));
  } else {
    console.log('   ❌ Memorial pallet 交易接口不存在！');
  }
  
  await api.disconnect();
}

main().catch(console.error);
