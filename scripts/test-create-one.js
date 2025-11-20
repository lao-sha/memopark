const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { cryptoWaitReady } = require('@polkadot/util-crypto');

async function main() {
  console.log('🧪 测试创建单个祭祀品...\n');
  
  await cryptoWaitReady();
  const wsProvider = new WsProvider('ws://127.0.0.1:9944');
  const api = await ApiPromise.create({ provider: wsProvider });
  
  const keyring = new Keyring({ type: 'sr25519' });
  const alice = keyring.addFromUri('//Alice');
  
  console.log(`管理员: ${alice.address}`);
  
  const { data: { free } } = await api.query.system.account(alice.address);
  console.log(`余额: ${free.toHuman()}\n`);
  
  // 检查 Alice 是否是 Sudo
  const sudoKey = await api.query.sudo.key();
  console.log(`Sudo 账户: ${sudoKey.toString()}`);
  console.log(`Alice 是 Sudo: ${sudoKey.toString() === alice.address}\n`);
  
  // 测试创建一个简单的祭祀品
  console.log('📝 创建测试祭祀品...');
  
  const tx = api.tx.memorial.createSacrifice(
    '测试鲜花',                    // name
    'bafytest123',               // resource_url  
    '测试描述',                   // description
    false,                       // is_vip_exclusive
    1000000000000000,           // fixed_price (1 DUST)
    null,                        // unit_price_per_week
    3,                           // scene (Memorial)
    0                            // category (Flower)
  );
  
  await new Promise((resolve, reject) => {
    tx.signAndSend(alice, ({ status, events, dispatchError }) => {
      console.log(`状态: ${status.type}`);
      
      if (status.isInBlock) {
        console.log(`✅ 交易已打包到区块: ${status.asInBlock.toString()}`);
        
        // 检查事件
        events.forEach(({ event }) => {
          console.log(`   事件: ${event.section}.${event.method}`);
          if (event.section === 'memorial') {
            console.log(`   数据: ${JSON.stringify(event.data.toHuman())}`);
          }
        });
        
        if (dispatchError) {
          if (dispatchError.isModule) {
            const decoded = api.registry.findMetaError(dispatchError.asModule);
            console.error(`\n❌ 执行错误: ${decoded.section}.${decoded.name}`);
            console.error(`   描述: ${decoded.docs.join(' ')}`);
          } else {
            console.error(`\n❌ 执行错误: ${dispatchError.toString()}`);
          }
          reject(new Error('Transaction failed'));
        } else {
          console.log('✅ 交易执行成功！');
          resolve();
        }
      }
    });
  });
  
  // 验证创建结果
  const nextId = await api.query.memorial.nextSacrificeId();
  console.log(`\n📊 NextSacrificeId: ${nextId.toNumber()}`);
  
  if (nextId.toNumber() > 0) {
    const sacrifice = await api.query.memorial.sacrificeOf(nextId.toNumber() - 1);
    if (sacrifice.isSome) {
      const data = sacrifice.unwrap();
      const name = new TextDecoder().decode(new Uint8Array(data.name.toU8a()));
      console.log(`✅ 成功创建: ${name}`);
    }
  }
  
  await api.disconnect();
}

main().catch(console.error).finally(() => process.exit());
