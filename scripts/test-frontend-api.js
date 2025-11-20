const { ApiPromise, WsProvider } = require('@polkadot/api');

async function main() {
  console.log('🔍 模拟前端查询祭祀品列表\n');
  
  const wsProvider = new WsProvider('ws://127.0.0.1:9944');
  const api = await ApiPromise.create({ provider: wsProvider });
  
  // 方法1：通过 entries() 获取所有祭祀品
  console.log('方法1: 使用 sacrificeOf.entries()');
  const entries = await api.query.memorial.sacrificeOf.entries();
  
  console.log(`   找到 ${entries.length} 个祭祀品\n`);
  
  if (entries.length > 0) {
    console.log('   前5个祭祀品:');
    entries.slice(0, 5).forEach(([key, value]) => {
      const id = key.args[0].toNumber();
      const data = value.unwrap();
      const name = new TextDecoder().decode(new Uint8Array(data.name.toU8a()));
      const resourceUrl = new TextDecoder().decode(new Uint8Array(data.resourceUrl.toU8a()));
      console.log(`      ${id}. ${name} - ${resourceUrl.substring(0, 30)}...`);
    });
  }
  
  // 方法2：通过 NextSacrificeId 遍历
  console.log('\n方法2: 通过 NextSacrificeId 遍历');
  const nextId = await api.query.memorial.nextSacrificeId();
  console.log(`   NextSacrificeId: ${nextId.toNumber()}`);
  
  // 方法3：检查前端使用的接口是否存在（CategoryBrowse.tsx）
  console.log('\n方法3: 检查类别索引接口（前端使用）');
  console.log(`   sacrificesBySecondary: ${api.query.memorial.sacrificesBySecondary ? '✅ 存在' : '❌ 不存在'}`);
  console.log(`   categoryOf: ${api.query.memorial.categoryOf ? '✅ 存在' : '❌ 不存在'}`);
  console.log(`   childrenByCategory: ${api.query.memorial.childrenByCategory ? '✅ 存在' : '❌ 不存在'}`);
  
  await api.disconnect();
  console.log('\n✅ 测试完成');
}

main().catch(console.error);
