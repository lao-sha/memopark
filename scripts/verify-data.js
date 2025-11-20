const { ApiPromise, WsProvider } = require('@polkadot/api');
const { cryptoWaitReady } = require('@polkadot/util-crypto');

async function main() {
  await cryptoWaitReady();
  const wsProvider = new WsProvider('ws://127.0.0.1:9944');
  const api = await ApiPromise.create({ provider: wsProvider });
  
  // 查询 NextSacrificeId
  const nextId = await api.query.memorial.nextSacrificeId();
  const count = nextId.toNumber();
  
  console.log(`📊 NextSacrificeId: ${count}`);
  console.log(`📊 实际祭祀品数量: ${count > 0 ? count - 1 : 0} 个\n`);
  
  if (count > 1) {
    // 查询所有祭祀品
    console.log('📋 所有祭祀品列表:\n');
    
    for (let i = 1; i < count; i++) {
      const sacrifice = await api.query.memorial.sacrificeOf(i);
      
      if (sacrifice.isSome) {
        const data = sacrifice.unwrap();
        const name = new TextDecoder().decode(new Uint8Array(data.name.toU8a()));
        const fixedPrice = data.fixedPrice.isSome ? 
          (Number(data.fixedPrice.unwrap().toString()) / 1_000_000_000_000_000).toFixed(0) : 
          null;
        const unitPrice = data.unitPricePerWeek.isSome ? 
          (Number(data.unitPricePerWeek.unwrap().toString()) / 1_000_000_000_000_000).toFixed(0) : 
          null;
        
        const priceStr = fixedPrice ? `${fixedPrice}元(固定)` : 
                        (unitPrice ? `${unitPrice}元/周` : '未定价');
        
        console.log(`${i.toString().padStart(2)}. ${name.padEnd(20)} ${priceStr}`);
      }
    }
  } else {
    console.log('⚠️  链上还没有祭祀品数据');
  }
  
  await api.disconnect();
}

main().catch(console.error);
