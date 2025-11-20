const { ApiPromise, WsProvider } = require('@polkadot/api');
const { Keyring } = require('@polkadot/api');
const { cryptoWaitReady } = require('@polkadot/util-crypto');

async function main() {
  await cryptoWaitReady();
  
  const wsProvider = new WsProvider('ws://127.0.0.1:9944');
  const api = await ApiPromise.create({ provider: wsProvider });
  
  const keyring = new Keyring({ type: 'sr25519' });
  const alice = keyring.addFromUri('//Alice');
  
  const { data: { free, reserved, frozen } } = await api.query.system.account(alice.address);
  
  console.log('💰 Alice 账户余额信息:');
  console.log(`   地址: ${alice.address}`);
  console.log(`   可用余额: ${free.toHuman()}`);
  console.log(`   保留余额: ${reserved.toHuman()}`);
  console.log(`   冻结余额: ${frozen.toHuman()}`);
  console.log(`   实际可用: ${(free.toBigInt() - frozen.toBigInt()).toString()}`);
  
  await api.disconnect();
}

main().catch(console.error);
