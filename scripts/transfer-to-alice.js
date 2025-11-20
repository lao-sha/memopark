const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { cryptoWaitReady } = require('@polkadot/util-crypto');

async function main() {
  console.log('💸 开始给 Alice 转账...\n');
  
  await cryptoWaitReady();
  
  const wsProvider = new WsProvider('ws://127.0.0.1:9944');
  const api = await ApiPromise.create({ provider: wsProvider });
  
  const keyring = new Keyring({ type: 'sr25519' });
  
  // Alice 账户
  const alice = keyring.addFromUri('//Alice');
  
  // 创世富账户 (需要找到对应的助记词)
  // 让我们尝试使用 Sudo 账户
  const sudoKey = await api.query.sudo.key();
  console.log(`Sudo 账户: ${sudoKey.toString()}`);
  
  // 检查 Sudo 账户余额
  const sudoInfo = await api.query.system.account(sudoKey.toString());
  console.log(`Sudo 余额: ${sudoInfo.data.free.toHuman()}\n`);
  
  // 如果 Sudo 账户就是富账户，我们需要找到对应的私钥
  // 否则需要通过其他方式转账
  
  await api.disconnect();
}

main().catch(console.error);
