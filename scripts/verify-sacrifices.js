const { ApiPromise, WsProvider } = require('@polkadot/api');
const { cryptoWaitReady } = require('@polkadot/util-crypto');

async function main() {
  console.log('🔍 验证链上祭祀品数据...\n');
  
  await cryptoWaitReady();
  const wsProvider = new WsProvider('ws://127.0.0.1:9944');
  const api = await ApiPromise.create({ provider: wsProvider });
  
  // 查询 NextSacrificeId
  const nextId = await api.query.memorial.nextSacrificeId();
  console.log(`📊 链上祭祀品总数: ${nextId.toNumber() - 1} 个\n`);
  
  // 列出前10个祭祀品
  console.log('📋 前10个祭祀品详情:\n');
  
  for (let i = 1; i <= Math.min(10, nextId.toNumber() - 1); i++) {
    const sacrifice = await api.query.memorial.sacrificeOf(i);
    
    if (sacrifice.isSome) {
      const data = sacrifice.unwrap();
      const name = new TextDecoder().decode(new Uint8Array(data.name.toU8a()));
      const desc = new TextDecoder().decode(new Uint8Array(data.description.toU8a()));
      const status = data.status.toString();
      const fixedPrice = data.fixedPrice.isSome ? data.fixedPrice.unwrap().toString() : null;
      const unitPrice = data.unitPricePerWeek.isSome ? data.unitPricePerWeek.unwrap().toString() : null;
      
      console.log(`${i.toString().padStart(2)}. ${name}`);
      console.log(`    描述: ${desc}`);
      console.log(`    状态: ${status}`);
      console.log(`    VIP专属: ${data.isVipExclusive.toString()}`);
      
      if (fixedPrice) {
        const dust = Number(fixedPrice) / 1_000_000_000_000_000;
        console.log(`    固定价格: ${dust} DUST`);
      }
      if (unitPrice) {
        const dust = Number(unitPrice) / 1_000_000_000_000_000;
        console.log(`    周单价: ${dust} DUST/周`);
      }
      console.log('');
    }
  }
  
  await api.disconnect();
}

main().catch(console.error);
