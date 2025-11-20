const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { cryptoWaitReady } = require('@polkadot/util-crypto');

async function main() {
  console.log('💸 使用 Sudo 权限转账给 Alice...\n');
  
  await cryptoWaitReady();
  
  const wsProvider = new WsProvider('ws://127.0.0.1:9944');
  const api = await ApiPromise.create({ provider: wsProvider });
  
  const keyring = new Keyring({ type: 'sr25519' });
  const alice = keyring.addFromUri('//Alice');
  
  const richAccount = '5CrDBEVDgXUwctSuV8EvQEBo2m187PcxoY36V7H7PGErHUW4';
  const transferAmount = BigInt(50_000_000_000) * BigInt(1_000_000_000_000); // 50万亿 DUST
  
  console.log(`从 ${richAccount}`);
  console.log(`转账到 Alice: ${alice.address}`);
  console.log(`金额: ${transferAmount.toString()}\n`);
  
  try {
    // 使用 Sudo 强制转账
    const forceTransfer = api.tx.balances.forceTransfer(
      richAccount,
      alice.address,
      transferAmount.toString()
    );
    
    const sudoTx = api.tx.sudo.sudo(forceTransfer);
    
    console.log('📤 发送交易...');
    
    await new Promise((resolve, reject) => {
      sudoTx.signAndSend(alice, ({ status, events, dispatchError }) => {
        if (status.isInBlock || status.isFinalized) {
          if (dispatchError) {
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              reject(new Error(`${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`));
            } else {
              reject(new Error(dispatchError.toString()));
            }
          } else {
            console.log(`✅ 转账成功！区块: ${status.asInBlock || status.asFinalized}`);
            resolve();
          }
        }
      });
    });
    
    // 检查新余额
    const { data: { free } } = await api.query.system.account(alice.address);
    console.log(`\n💰 Alice 新余额: ${free.toHuman()}`);
    
  } catch (error) {
    console.error(`\n❌ 转账失败: ${error.message}`);
  }
  
  await api.disconnect();
}

main().catch(console.error);
