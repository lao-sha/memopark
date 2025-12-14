const { ApiPromise, WsProvider } = require('@polkadot/api');

async function main() {
  const provider = new WsProvider('ws://127.0.0.1:9944');
  const api = await ApiPromise.create({ provider });
  
  console.log('✓ 连接到节点成功');
  
  // 检查 BaziChart pallet
  if (api.tx.baziChart) {
    console.log('✓ BaziChart pallet 已加载');
    console.log('  可用方法:');
    Object.keys(api.tx.baziChart).forEach(method => {
      console.log('    - ' + method);
    });
  } else {
    console.log('✗ BaziChart pallet 未找到');
  }
  
  await api.disconnect();
}

main().catch(console.error);
