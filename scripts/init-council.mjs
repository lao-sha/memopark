#!/usr/bin/env node

/**
 * 初始化委员会成员脚本
 * 功能：使用 sudo 设置 Alice, Bob, Charlie 为委员会成员
 */

import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';

const WS_URL = 'ws://127.0.0.1:9944';

async function main() {
  console.log('🚀 开始初始化委员会成员...\n');

  // 1. 连接到链
  console.log(`📡 连接到节点: ${WS_URL}`);
  const provider = new WsProvider(WS_URL);
  const api = await ApiPromise.create({ provider });
  await api.isReady;
  console.log('✅ 已连接到链\n');

  // 2. 创建密钥环
  const keyring = new Keyring({ type: 'sr25519' });
  const alice = keyring.addFromUri('//Alice');
  const bob = keyring.addFromUri('//Bob');
  const charlie = keyring.addFromUri('//Charlie');

  console.log('📋 委员会成员账户:');
  console.log(`  - Alice:   ${alice.address}`);
  console.log(`  - Bob:     ${bob.address}`);
  console.log(`  - Charlie: ${charlie.address}\n`);

  // 3. 检查当前委员会成员
  const currentMembers = await api.query.council.members();
  console.log(`当前委员会成员数: ${currentMembers.length}`);
  if (currentMembers.length > 0) {
    console.log('当前成员:', currentMembers.map(m => m.toString()).join(', '));
    console.log('⚠️  委员会已有成员，跳过初始化\n');
    await api.disconnect();
    return;
  }

  // 4. 设置委员会成员
  console.log('\n🔧 设置委员会成员...');
  const newMembers = [
    alice.address,
    bob.address,
    charlie.address
  ];

  // 使用 sudo 调用 council.setMembers
  const tx = api.tx.sudo.sudo(
    api.tx.council.setMembers(
      newMembers,   // new_members
      null,         // prime (可选)
      0             // old_count
    )
  );

  // 5. 发送交易
  return new Promise((resolve, reject) => {
    tx.signAndSend(alice, ({ status, dispatchError, events }) => {
      if (status.isInBlock) {
        console.log(`✅ 交易已打包，区块哈希: ${status.asInBlock.toHex()}`);

        // 检查是否有错误
        if (dispatchError) {
          if (dispatchError.isModule) {
            const decoded = api.registry.findMetaError(dispatchError.asModule);
            const { docs, name, section } = decoded;
            console.error(`❌ 错误: ${section}.${name}: ${docs.join(' ')}`);
            reject(new Error(`${section}.${name}`));
          } else {
            console.error(`❌ 错误: ${dispatchError.toString()}`);
            reject(dispatchError);
          }
          return;
        }

        // 检查事件
        events.forEach(({ event }) => {
          if (api.events.council.MembersChanged.is(event)) {
            console.log('✅ 委员会成员已更新');
          }
          if (api.events.sudo.Sudid.is(event)) {
            const [result] = event.data;
            if (result.isOk) {
              console.log('✅ Sudo 调用成功');
            } else {
              console.error('❌ Sudo 调用失败');
            }
          }
        });

        console.log('\n🎉 委员会初始化完成！');
        console.log('\n📊 验证结果:');
        api.query.council.members().then(members => {
          console.log(`委员会成员数: ${members.length}`);
          members.forEach((member, index) => {
            console.log(`  ${index + 1}. ${member.toString()}`);
          });
          api.disconnect().then(() => resolve());
        });
      }
    }).catch(reject);
  });
}

main()
  .then(() => {
    console.log('\n✅ 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 脚本执行失败:', error);
    process.exit(1);
  });

