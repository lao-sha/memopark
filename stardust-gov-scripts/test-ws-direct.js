#!/usr/bin/env node

const { WsProvider } = require('@polkadot/api');

async function testWS() {
  console.log('🔍 测试 WebSocket 连接...\n');
  
  const wsUrl = 'ws://127.0.0.1:9944';
  console.log('目标: ' + wsUrl);
  
  try {
    const provider = new WsProvider(wsUrl, false, {}, 3000);
    
    const connected = await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 3000);
      
      provider.on('connected', () => {
        clearTimeout(timeout);
        resolve(true);
      });
      
      provider.on('error', (error) => {
        clearTimeout(timeout);
        console.error('连接错误:', error.message);
        resolve(false);
      });
    });
    
    if (connected) {
      console.log('✅ WebSocket 连接成功！');
      console.log('\n💡 节点的 9944 端口支持 WebSocket');
      console.log('💡 可以运行: npm run create-offerings');
      await provider.disconnect();
    } else {
      console.log('❌ WebSocket 连接失败');
      console.log('\n💡 端口 9944 可能只支持 HTTP RPC');
      console.log('💡 需要重启节点并添加 --ws-port 参数');
    }
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

testWS();

