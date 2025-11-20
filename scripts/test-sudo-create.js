const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { cryptoWaitReady } = require('@polkadot/util-crypto');

async function main() {
  console.log('🧪 使用 Sudo 创建祭祀品...\n');
  
  await cryptoWaitReady();
  const wsProvider = new WsProvider('ws://127.0.0.1:9944');
  const api = await ApiPromise.create({ provider: wsProvider });
  
  const keyring = new Keyring({ type: 'sr25519' });
  const alice = keyring.addFromUri('//Alice');
  
  // 创建祭祀品交易
  const createTx = api.tx.memorial.createSacrifice(
    '测试鲜花',                    // name
    'bafytest123',               // resource_url  
    '测试描述',                   // description
    false,                       // is_vip_exclusive
    1000000000000000,           // fixed_price (1 DUST)
    null,                        // unit_price_per_week
    3,                           // scene (Memorial)
    0                            // category (Flower)
  );
  
  // 使用 sudo 包装
  const sudoTx = api.tx.sudo.sudo(createTx);
  
  console.log('📝 通过 Sudo 创建祭祀品...');
  
  await new Promise((resolve, reject) => {
    sudoTx.signAndSend(alice, ({ status, events, dispatchError }) => {
      if (status.isInBlock) {
        console.log(`✅ 交易已打包: ${status.asInBlock.toString()}\n`);
        
        // 显示所有事件
        events.forEach(({ event }) => {
          console.log(`   ${event.section}.${event.method}:`);
          if (event.section === 'memorial') {
            console.log(`      数据: ${JSON.stringify(event.data.toHuman())}`);
          } else if (event.section === 'sudo') {
            console.log(`      ${JSON.stringify(event.data.toHuman())}`);
          }
        });
        
        if (dispatchError) {
          if (dispatchError.isModule) {
            const decoded = api.registry.findMetaError(dispatchError.asModule);
            console.error(`\n❌ 错误: ${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`);
          }
          reject(new Error('Failed'));
        } else {
          resolve();
        }
      }
    });
  });
  
  // 验证
  const nextId = await api.query.memorial.nextSacrificeId();
  console.log(`\n📊 NextSacrificeId: ${nextId.toNumber()}`);
  
  if (nextId.toNumber() > 0) {
    const sacrifice = await api.query.memorial.sacrificeOf(nextId.toNumber() - 1);
    if (sacrifice.isSome) {
      const data = sacrifice.unwrap();
      const name = new TextDecoder().decode(new Uint8Array(data.name.toU8a()));
      console.log(`✅ 成功创建祭祀品: ${name}`);
    }
  }
  
  await api.disconnect();
}

main().catch(console.error).finally(() => process.exit());
