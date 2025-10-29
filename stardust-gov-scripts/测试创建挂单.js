/**
 * 函数级中文注释：测试创建挂单功能脚本
 * 
 * 功能说明：
 * 1. 连接到本地链端
 * 2. 使用测试账户创建一个 OTC 挂单
 * 3. 验证交易是否成功
 * 
 * 目的：诊断前端创建挂单失败的原因
 */

const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');

async function testCreateListing() {
  console.log('🏭 开始测试创建挂单...\n');

  try {
    // 连接到链端
    const provider = new WsProvider('ws://localhost:9944');
    const api = await ApiPromise.create({ provider });
    console.log('✅ 链端连接成功');

    // 创建测试账户
    const keyring = new Keyring({ type: 'sr25519' });
    // 使用前端相同的账户
    const maker = keyring.addFromUri('//Bob');
    console.log('👤 做市商账户:', maker.address);

    // 检查账户余额
    const { data: balance } = await api.query.system.account(maker.address);
    console.log('💰 账户余额:', balance.free.toString(), 'Planck\n');

    // 检查是否是做市商
    console.log('📋 查询活跃做市商列表...');
    const entries = await api.query.marketMaker.activeMarketMakers.entries();
    console.log(`   找到 ${entries.length} 个活跃做市商\n`);

    // 获取做市商信息
    let makerMmId = null;
    for (const [key, value] of entries) {
      if (value.isSome) {
        const info = value.unwrap();
        const mmId = key.args[0].toString();
        const owner = info.owner.toString();
        console.log(`   检查做市商 #${mmId}: ${owner}`);
        
        if (owner === maker.address) {
          makerMmId = mmId;
          console.log(`✅ 找到做市商身份, mmId: ${makerMmId}\n`);
          break;
        }
      }
    }

    if (makerMmId === null) {
      console.log('❌ 该账户不是做市商');
      process.exit(1);
    }

    // 创建挂单参数（与前端一致）
    console.log('📝 准备创建挂单参数...');
    
    const side = 1;        // Sell (0=Buy, 1=Sell)
    const base = 0;        // MEMO 资产 ID
    const quote = 1;       // CNY 资产 ID
    const pricingSpreadBps = 100;  // 价差（基点）
    const minQty = '1111000000000000';  // 最小数量
    const maxQty = '111111000000000000';  // 最大数量
    const total = '1111111000000000000';  // 总库存
    const partial = true;  // 允许部分成交
    const expireAt = 22222;  // 过期时间（块号）
    const priceMin = '10000000000';  // 最低价格
    const priceMax = '20000000000';  // 最高价格
    const termsCommit = null;  // 条款承诺

    console.log('   参数详情:');
    console.log(`   - side: ${side} (${side === 0 ? 'Buy' : 'Sell'})`);
    console.log(`   - base: ${base} (MEMO)`);
    console.log(`   - quote: ${quote} (CNY)`);
    console.log(`   - pricingSpreadBps: ${pricingSpreadBps}`);
    console.log(`   - minQty: ${minQty}`);
    console.log(`   - maxQty: ${maxQty}`);
    console.log(`   - total: ${total}`);
    console.log(`   - partial: ${partial}`);
    console.log(`   - expireAt: ${expireAt}`);
    console.log(`   - priceMin: ${priceMin}`);
    console.log(`   - priceMax: ${priceMax}`);
    console.log(`   - termsCommit: ${termsCommit}\n`);

    // 构建交易
    console.log('🔨 构建交易...');
    const tx = api.tx.otcListing.createListing(
      side,
      base,
      quote,
      pricingSpreadBps,
      minQty,
      maxQty,
      total,
      partial,
      expireAt,
      priceMin,
      priceMax,
      termsCommit
    );
    console.log('✅ 交易已构建');
    console.log('   📋 交易方法:', `${tx.method.section}.${tx.method.method}`);
    console.log('   📋 参数数量:', tx.method.args.length);
    console.log('   📋 编码长度:', tx.encodedLength);
    console.log('   📋 交易哈希:', tx.hash.toHex());

    // 打印每个参数的类型和值
    console.log('\n   📋 参数详细信息:');
    tx.method.args.forEach((arg, idx) => {
      const argMeta = tx.method.meta.args[idx];
      console.log(`   [${idx}] ${argMeta.name.toString()}: ${argMeta.type.toString()} = ${arg.toString()}`);
    });

    // 发送交易
    console.log('\n📤 发送交易...');
    await tx.signAndSend(maker, ({ status, events, dispatchError }) => {
      console.log('   📊 交易状态:', status.type);

      if (dispatchError) {
        if (dispatchError.isModule) {
          const decoded = api.registry.findMetaError(dispatchError.asModule);
          const { docs, name, section } = decoded;
          console.log(`   ❌ 调度错误: ${section}.${name}: ${docs.join(' ')}`);
        } else {
          console.log('   ❌ 调度错误:', dispatchError.toString());
        }
      }

      if (status.isInBlock) {
        console.log('   ✅ 交易已打包:', status.asInBlock.toHex());
        
        // 打印所有事件
        events.forEach(({ event }) => {
          console.log('   📌 事件:', `${event.section}.${event.method}`);
          
          if (event.method === 'ExtrinsicFailed') {
            console.log('   ❌ 交易执行失败');
          } else if (event.method === 'ListingCreated') {
            console.log('   🎉 挂单创建成功！');
          }
        });
      } else if (status.isFinalized) {
        console.log('   ✅ 交易已确认:', status.asFinalized.toHex());
        console.log('\n🎊 测试完成！');
        process.exit(0);
      }
    });

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error('\n🔍 错误堆栈:');
    console.error(error.stack);
    process.exit(1);
  }
}

// 主函数执行
testCreateListing().catch(error => {
  console.error('❌ 未捕获的错误:', error);
  process.exit(1);
});

