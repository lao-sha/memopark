#!/usr/bin/env node

/**
 * 诊断脚本 - 测试连接和依赖
 */

console.log('🔍 开始诊断...\n');

// 1. 检查 Node.js 版本
console.log('1️⃣ Node.js 版本:', process.version);

// 2. 检查依赖
console.log('\n2️⃣ 检查依赖...');
try {
  const { ApiPromise, WsProvider } = require('@polkadot/api');
  console.log('   ✅ @polkadot/api 已安装');
  
  const { cryptoWaitReady } = require('@polkadot/util-crypto');
  console.log('   ✅ @polkadot/util-crypto 已安装');
} catch (error) {
  console.error('   ❌ 依赖缺失:', error.message);
  console.log('\n💡 请运行: npm install');
  process.exit(1);
}

// 3. 测试连接
async function testConnection() {
  console.log('\n3️⃣ 测试链连接...');
  
  const DEFAULT_WS_ENDPOINT = process.env.MEMOPARK_WS || 'ws://127.0.0.1:9944';
  console.log('   节点地址:', DEFAULT_WS_ENDPOINT);
  
  try {
    const { ApiPromise, WsProvider } = require('@polkadot/api');
    const { cryptoWaitReady } = require('@polkadot/util-crypto');
    
    await cryptoWaitReady();
    console.log('   ✅ 加密库准备完成');
    
    console.log('   🔌 正在连接...');
    
    const provider = new WsProvider(DEFAULT_WS_ENDPOINT, false, {}, 5000);
    
    // 设置超时
    const timeout = setTimeout(() => {
      console.error('   ❌ 连接超时（5秒）');
      console.log('\n💡 可能的原因:');
      console.log('   1. 链节点未启动');
      console.log('   2. WS 地址错误');
      console.log('   3. 端口被占用');
      console.log('\n💡 解决方案:');
      console.log('   1. 启动链节点: cd /path/to/memopark && ./target/release/node-template --dev');
      console.log('   2. 检查端口: netstat -tuln | grep 9944');
      console.log('   3. 使用正确的 WS 地址: export MEMOPARK_WS=ws://127.0.0.1:9944');
      process.exit(1);
    }, 5000);
    
    const api = await ApiPromise.create({ 
      provider,
      throwOnConnect: true,
    });
    
    clearTimeout(timeout);
    
    const [chain, nodeName, nodeVersion] = await Promise.all([
      api.rpc.system.chain(),
      api.rpc.system.name(),
      api.rpc.system.version(),
    ]);
    
    console.log(`   ✅ 已连接 ${chain.toHuman()} • ${nodeName.toHuman()} v${nodeVersion.toHuman()}`);
    
    // 4. 检查 memorialOfferings pallet
    console.log('\n4️⃣ 检查 pallet...');
    
    if (api.tx.memorialOfferings) {
      console.log('   ✅ memorialOfferings pallet 可用');
      
      if (api.tx.memorialOfferings.createOffering) {
        console.log('   ✅ createOffering extrinsic 可用');
      } else {
        console.log('   ❌ createOffering extrinsic 不可用');
      }
    } else {
      console.log('   ❌ memorialOfferings pallet 不可用');
      console.log('\n💡 请确保链上已部署 memorial-offerings pallet');
    }
    
    await api.disconnect();
    
    console.log('\n✅ 诊断完成 - 所有检查通过！');
    console.log('💡 可以运行: npm run create-offerings\n');
    
  } catch (error) {
    console.error('\n❌ 发生错误:', error.message);
    console.error('\n堆栈跟踪:');
    console.error(error.stack);
    
    console.log('\n💡 故障排除:');
    console.log('   1. 确认链节点已启动');
    console.log('   2. 检查 WS 地址是否正确');
    console.log('   3. 查看链节点日志');
    console.log('   4. 确认 memo-offerings pallet 已部署\n');
    
    process.exit(1);
  }
}

testConnection().catch(error => {
  console.error('❌ 未捕获的错误:', error);
  process.exit(1);
});

