#!/usr/bin/env node

/**
 * 重置委员会成员为标准开发账户
 * 使用 Alice (sudo) 设置 Alice, Bob, Charlie 为委员会成员
 */

import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';

const WS_URL = 'ws://127.0.0.1:9944';

async function main() {
  console.log('🔄 重置委员会成员为标准开发账户...\n');

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

  console.log('📋 新的委员会成员账户:');
  console.log(`  - Alice:   ${alice.address}`);
  console.log(`  - Bob:     ${bob.address}`);
  console.log(`  - Charlie: ${charlie.address}\n`);

  // 3. 检查当前委员会成员
  const currentMembers = await api.query.council.members();
  console.log(`当前委员会成员数: ${currentMembers.length}`);
  if (currentMembers.length > 0) {
    console.log('当前成员:');
    currentMembers.forEach((m, i) => console.log(`  ${i + 1}. ${m.toString()}`));
  }

  // 4. 重置委员会成员
  console.log('\n🔧 重置委员会成员...');
  const newMembers = [
    alice.address,
    bob.address,
    charlie.address
  ];

  // 使用 sudo 调用 council.setMembers
  const tx = api.tx.sudo.sudo(
    api.tx.council.setMembers(
      newMembers,                   // new_members
      alice.address,                // prime (设置 Alice 为主要成员)
      currentMembers.length         // old_count
    )
  );

  // 5. 发送交易
  return new Promise((resolve, reject) => {
    let blockHash = null;
    
    tx.signAndSend(alice, ({ status, dispatchError, events }) => {
      if (status.isInBlock) {
        blockHash = status.asInBlock.toHex();
        console.log(`✅ 交易已打包，区块哈希: ${blockHash}`);

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
        let sudoSuccess = false;
        let membersChanged = false;

        events.forEach(({ event }) => {
          if (api.events.council.MembersChanged.is(event)) {
            console.log('✅ 委员会成员已更新');
            membersChanged = true;
          }
          if (api.events.sudo.Sudid.is(event)) {
            const [result] = event.data;
            if (result.isOk) {
              console.log('✅ Sudo 调用成功');
              sudoSuccess = true;
            } else {
              console.error('❌ Sudo 调用失败:', result.asErr.toString());
            }
          }
        });

        if (sudoSuccess && membersChanged) {
          console.log('\n🎉 委员会重置完成！');
          console.log('\n📊 验证新成员:');
          api.query.council.members().then(members => {
            console.log(`委员会成员数: ${members.length}`);
            members.forEach((member, index) => {
              const memberStr = member.toString();
              let name = '';
              if (memberStr === alice.address) name = '(Alice)';
              else if (memberStr === bob.address) name = '(Bob)';
              else if (memberStr === charlie.address) name = '(Charlie)';
              console.log(`  ${index + 1}. ${memberStr} ${name}`);
            });

            console.log('\n✅ 现在你可以使用以下账户进行委员会操作:');
            console.log('  - Polkadot.js Extension 中导入 Alice, Bob, Charlie');
            console.log('  - 或者在治理平台连接这些账户');
            console.log('  - Alice, Bob, Charlie 的助记词都是标准开发账户');

            api.disconnect().then(() => resolve());
          });
        } else {
          reject(new Error('委员会更新失败'));
        }
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
    console.error('\n❌ 脚本执行失败:', error.message || error);
    process.exit(1);
  });

