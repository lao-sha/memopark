#!/usr/bin/env node
/**
 * Stardust Runtime 链上升级脚本
 *
 * 功能：通过 sudo 权限将新的 runtime wasm 上传到链上
 *
 * 使用方法：
 * 1. 确保链正在运行：./target/release/solochain-template-node --dev
 * 2. 运行脚本：node scripts/upgrade-runtime.js
 *
 * 注意：
 * - 仅用于开发环境（使用 Alice 的 sudo 权限）
 * - 生产环境应该使用治理流程
 * - 升级前确保 spec_version 已递增
 */

const { ApiPromise, WsProvider } = require('@polkadot/api');
const { Keyring } = require('@polkadot/keyring');
const fs = require('fs');
const path = require('path');

// 配置
const WS_ENDPOINT = process.env.WS_ENDPOINT || 'ws://localhost:9944';
const WASM_PATH = path.join(
  __dirname,
  '../target/release/wbuild/stardust-runtime/stardust_runtime.compact.compressed.wasm'
);

async function main() {
  console.log('🚀 Stardust Runtime 升级工具');
  console.log('═'.repeat(60));

  // 1. 检查 wasm 文件是否存在
  if (!fs.existsSync(WASM_PATH)) {
    console.error('❌ 错误: 找不到 wasm 文件');
    console.error(`   路径: ${WASM_PATH}`);
    console.error('   请先编译 runtime: cargo build --release -p stardust-runtime');
    process.exit(1);
  }

  const wasmSize = fs.statSync(WASM_PATH).size;
  console.log(`✅ 找到 wasm 文件 (${(wasmSize / 1024).toFixed(2)} KB)`);
  console.log(`   路径: ${WASM_PATH}`);

  // 2. 连接到节点
  console.log(`\n📡 连接到节点: ${WS_ENDPOINT}`);
  const wsProvider = new WsProvider(WS_ENDPOINT);
  const api = await ApiPromise.create({ provider: wsProvider });

  // 3. 获取当前 runtime 版本
  const version = await api.rpc.state.getRuntimeVersion();
  console.log(`\n📦 当前 Runtime 版本:`);
  console.log(`   spec_name: ${version.specName}`);
  console.log(`   spec_version: ${version.specVersion}`);
  console.log(`   impl_version: ${version.implVersion}`);

  // 4. 读取新的 wasm
  console.log(`\n📂 读取新的 runtime wasm...`);
  const code = fs.readFileSync(WASM_PATH);
  console.log(`   大小: ${(code.length / 1024).toFixed(2)} KB`);

  // 5. 准备 Alice 账户（sudo 权限）
  const keyring = new Keyring({ type: 'sr25519' });
  const alice = keyring.addFromUri('//Alice');
  console.log(`\n👤 使用 sudo 账户: ${alice.address}`);

  // 6. 创建升级交易
  console.log(`\n🔨 创建升级交易...`);
  const tx = api.tx.sudo.sudoUncheckedWeight(
    api.tx.system.setCode(code),
    0 // weight 设为 0，让 runtime 自动计算
  );

  // 7. 发送交易
  console.log(`\n📤 发送升级交易...`);
  console.log(`   ⚠️  这将升级链上 runtime`);
  console.log(`   ⏳ 等待交易打包...`);

  return new Promise((resolve, reject) => {
    tx.signAndSend(alice, ({ status, events, dispatchError }) => {
      // 交易状态更新
      if (status.isInBlock) {
        console.log(`\n✅ 交易已打包到区块: ${status.asInBlock.toHex()}`);
      } else if (status.isFinalized) {
        console.log(`\n🎉 交易已最终确认: ${status.asFinalized.toHex()}`);

        // 检查事件
        let upgradeSuccess = false;
        events.forEach(({ event }) => {
          const { section, method, data } = event;
          console.log(`   📋 事件: ${section}.${method}`);

          // 检查是否有错误
          if (section === 'system' && method === 'ExtrinsicFailed') {
            console.error('   ❌ 升级失败');
            if (dispatchError) {
              if (dispatchError.isModule) {
                const decoded = api.registry.findMetaError(dispatchError.asModule);
                console.error(`   错误: ${decoded.section}.${decoded.name}: ${decoded.docs}`);
              } else {
                console.error(`   错误: ${dispatchError.toString()}`);
              }
            }
          }

          // 检查升级成功事件
          if (section === 'system' && method === 'CodeUpdated') {
            upgradeSuccess = true;
            console.log('   ✅ Runtime 代码已更新');
          }
        });

        if (upgradeSuccess) {
          console.log(`\n${'═'.repeat(60)}`);
          console.log('🎊 Runtime 升级成功！');
          console.log(`${'═'.repeat(60)}`);

          // 获取新版本
          api.rpc.state.getRuntimeVersion().then((newVersion) => {
            console.log(`\n📦 新 Runtime 版本:`);
            console.log(`   spec_version: ${newVersion.specVersion}`);
            console.log(`   impl_version: ${newVersion.implVersion}`);
            console.log('\n💡 提示: 节点会自动使用新的 runtime，无需重启');
            process.exit(0);
          });
        } else {
          console.error('\n❌ 升级失败，请检查日志');
          process.exit(1);
        }
      }
    }).catch((error) => {
      console.error('❌ 发送交易失败:', error);
      process.exit(1);
    });
  });
}

main()
  .catch((error) => {
    console.error('❌ 升级失败:', error);
    process.exit(1);
  });
