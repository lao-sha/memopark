#!/usr/bin/env node
/**
 * 函数级详细中文注释：检查 deceased pallet 的所有可用查询和交易接口
 * 
 * 用途：
 * - 诊断前端报错："未找到 deceased-media 查询接口"
 * - 列出 deceased pallet 的所有可用接口
 * - 验证 media 和 text 模块是否已正确暴露
 * 
 * 运行方式：
 * node scripts/检查deceased-pallet接口.mjs
 */

import { ApiPromise, WsProvider } from '@polkadot/api';

const WS_ENDPOINT = process.env.WS_ENDPOINT || 'ws://127.0.0.1:9944';

async function main() {
  console.log('======================================');
  console.log('  Deceased Pallet 接口检查工具');
  console.log('======================================');
  console.log('');
  console.log(`📡 连接节点: ${WS_ENDPOINT}`);
  
  try {
    const provider = new WsProvider(WS_ENDPOINT);
    const api = await ApiPromise.create({ provider });
    
    console.log('✅ 节点连接成功');
    console.log('');
    
    // 检查 deceased pallet 是否存在
    const hasDeceased = api.query.deceased !== undefined;
    console.log(`🔍 deceased pallet: ${hasDeceased ? '✅ 存在' : '❌ 不存在'}`);
    
    if (!hasDeceased) {
      console.log('');
      console.log('❌ 错误：未找到 deceased pallet');
      console.log('');
      console.log('可用的 pallets:');
      console.log(Object.keys(api.query).sort().join(', '));
      process.exit(1);
    }
    
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  查询接口 (api.query.deceased.*)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    
    const queryKeys = Object.keys(api.query.deceased).sort();
    
    // 分类显示
    const mediaQueries = queryKeys.filter(k => /album|media|video|photo|audio/i.test(k));
    const textQueries = queryKeys.filter(k => /text|life|message|eulogy|article/i.test(k));
    const coreQueries = queryKeys.filter(k => 
      !(/album|media|video|photo|audio|text|life|message|eulogy|article/i.test(k))
    );
    
    console.log(`📊 总计: ${queryKeys.length} 个查询接口`);
    console.log('');
    
    if (coreQueries.length > 0) {
      console.log('🔹 核心查询（Deceased 基础）:');
      coreQueries.forEach(k => {
        console.log(`  - ${k}`);
      });
      console.log('');
    }
    
    if (mediaQueries.length > 0) {
      console.log('🎬 媒体查询（Media 模块）:');
      mediaQueries.forEach(k => {
        console.log(`  ✅ ${k}`);
      });
      console.log('');
    } else {
      console.log('❌ 媒体查询（Media 模块）: 未找到');
      console.log('   预期接口:');
      console.log('   - albumsByDeceased');
      console.log('   - albumOf');
      console.log('   - mediaByAlbum');
      console.log('   - mediaOf');
      console.log('   - videoCollectionsByDeceased');
      console.log('   - videoCollectionOf');
      console.log('');
    }
    
    if (textQueries.length > 0) {
      console.log('📝 文本查询（Text 模块）:');
      textQueries.forEach(k => {
        console.log(`  ✅ ${k}`);
      });
      console.log('');
    } else {
      console.log('❌ 文本查询（Text 模块）: 未找到');
      console.log('   预期接口:');
      console.log('   - lifeOf');
      console.log('   - messagesByDeceased');
      console.log('   - textOf');
      console.log('   - articlesByDeceased');
      console.log('');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  交易接口 (api.tx.deceased.*)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    
    const txKeys = Object.keys(api.tx.deceased).sort();
    const mediaTxs = txKeys.filter(k => /album|media|video|photo|audio/i.test(k));
    const textTxs = txKeys.filter(k => /text|life|message|eulogy|article/i.test(k));
    const coreTxs = txKeys.filter(k => 
      !(/album|media|video|photo|audio|text|life|message|eulogy|article/i.test(k))
    );
    
    console.log(`📊 总计: ${txKeys.length} 个交易接口`);
    console.log('');
    
    if (coreTxs.length > 0) {
      console.log('🔹 核心交易:');
      coreTxs.forEach(k => {
        console.log(`  - ${k}`);
      });
      console.log('');
    }
    
    if (mediaTxs.length > 0) {
      console.log('🎬 媒体交易:');
      mediaTxs.forEach(k => {
        console.log(`  ✅ ${k}`);
      });
      console.log('');
    } else {
      console.log('❌ 媒体交易: 未找到');
      console.log('');
    }
    
    if (textTxs.length > 0) {
      console.log('📝 文本交易:');
      textTxs.forEach(k => {
        console.log(`  ✅ ${k}`);
      });
      console.log('');
    } else {
      console.log('❌ 文本交易: 未找到');
      console.log('');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  诊断结果');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    
    if (mediaQueries.length === 0 && textQueries.length === 0) {
      console.log('⚠️  警告：Media 和 Text 模块的存储项未实现');
      console.log('');
      console.log('原因分析：');
      console.log('1. media.rs 和 text.rs 仅定义了数据结构');
      console.log('2. 存储项（StorageMap）未添加到 lib.rs 的 pallet 模块');
      console.log('3. 需要在 pallets/deceased/src/lib.rs 中添加存储定义');
      console.log('');
      console.log('解决方案：');
      console.log('1. 在 lib.rs 添加 media 和 text 的存储项');
      console.log('2. 或者暂时禁用前端的 media/text 功能');
      console.log('3. 或者显示友好提示："功能开发中"');
      process.exit(1);
    } else if (mediaQueries.length === 0) {
      console.log('⚠️  警告：Media 模块的存储项未实现');
      process.exit(1);
    } else if (textQueries.length === 0) {
      console.log('⚠️  警告：Text 模块的存储项未实现');
      process.exit(1);
    } else {
      console.log('✅ 所有模块接口正常');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('');
    console.error('❌ 错误:', error.message);
    console.error('');
    process.exit(1);
  }
}

main().catch(console.error);

