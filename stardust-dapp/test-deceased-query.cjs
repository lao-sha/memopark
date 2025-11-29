const { ApiPromise, WsProvider } = require('@polkadot/api');

async function main() {
  const provider = new WsProvider('ws://127.0.0.1:9944');
  const api = await ApiPromise.create({ provider });
  
  console.log('API 已连接');
  console.log('可用的 pallets:', Object.keys(api.query));
  
  // 检查 deceased 模块
  if (api.query.deceased) {
    console.log('\ndeceased 模块存在');
    console.log('deceased 方法:', Object.keys(api.query.deceased));
    
    if (api.query.deceased.nextDeceasedId) {
      const nextId = await api.query.deceased.nextDeceasedId();
      console.log('\nnextDeceasedId:', nextId.toString());
      console.log('（注：已改为随机ID，此值不再递增）');
    }

    // 使用 entries() 查询所有逝者（支持随机ID）
    if (api.query.deceased.deceasedOf) {
      console.log('\n使用 entries() 查询所有逝者...');
      const entries = await api.query.deceased.deceasedOf.entries();
      console.log(`找到 ${entries.length} 条逝者记录`);

      // 按创建时间排序，显示最新的5条
      const sortedEntries = entries
        .filter(([_, value]) => value.isSome)
        .map(([key, value]) => {
          const d = value.unwrap();
          return {
            id: key.args[0].toString(),
            created: d.created?.toNumber?.() || 0,
            data: d.toHuman()
          };
        })
        .sort((a, b) => b.created - a.created);

      console.log('\n按创建时间排序，最新的5条:');
      for (const entry of sortedEntries.slice(0, 5)) {
        console.log(`\n逝者 #${entry.id} (区块 ${entry.created}):`, JSON.stringify(entry.data, null, 2));
      }
    }
  } else {
    console.log('\ndeceased 模块不存在！');
    // 尝试其他可能的名称
    const possibleNames = ['memoDeceased', 'memo_deceased', 'Deceased'];
    for (const name of possibleNames) {
      if (api.query[name]) {
        console.log(`找到模块: ${name}`);
      }
    }
  }
  
  await api.disconnect();
}

main().catch(console.error);
