#!/usr/bin/env node

/**
 * 创建祭祀品脚本
 * 功能：使用指定账户创建50个随机参数的祭祀品（通过 pallet-memorial）
 *
 * pallet-memorial 的 create_sacrifice 参数：
 * - name: Vec<u8>                // 祭祀品名称
 * - description: Vec<u8>         // 描述
 * - resource_url: Vec<u8>        // 资源URL（IPFS CID）
 * - primary_category: u8         // 主分类（0-8）
 * - sub_category: u8             // 子分类
 * - price: u128                  // 价格
 * - stock: i32                   // 库存（-1表示无限）
 * - per_user_limit: Option<u32>  // 每用户限购
 * - quality_level: u8            // 品质等级（0-4）
 * - seasonal: bool               // 是否季节性商品
 */

const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { cryptoWaitReady } = require('@polkadot/util-crypto');

// 配置项
const DEFAULT_WS_ENDPOINT = process.env.MEMOPARK_WS || 'ws://127.0.0.1:9944';

// 管理员账户配置
// 使用 Alice 账户（Sudo 权限）
const ADMIN_CONFIG = {
  uri: '//Alice',  // Substrate 标准开发账户
  expectedAddress: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
};

// 创建配置
const CREATE_CONFIG = {
  sacrificeCount: 50,             // 创建祭祀品数量
  delayBetweenCreations: 500,     // 创建间延迟（毫秒）
};

// 祭祀品名称和描述库
const SACRIFICE_DATA = [
  { name: '白菊花束', desc: '素雅白菊，寄托哀思' },
  { name: '黄菊花束', desc: '黄菊花束，追思悼念' },
  { name: '百合花束', desc: '纯洁百合，象征高洁' },
  { name: '康乃馨花束', desc: '康乃馨花束，表达思念' },
  { name: '玫瑰花束', desc: '红玫瑰束，深情怀念' },
  { name: '花圈', desc: '精美花圈，庄重祭祀' },
  { name: '白蜡烛', desc: '白色蜡烛，照亮归途' },
  { name: '红蜡烛', desc: '红色蜡烛，温暖供奉' },
  { name: '檀香', desc: '清香檀香，净化心灵' },
  { name: '沉香', desc: '珍贵沉香，诚心供奉' },
  { name: '香炉', desc: '精美香炉，长久供奉' },
  { name: '水果供品', desc: '新鲜水果，四季供奉' },
  { name: '糕点供品', desc: '精美糕点，甜蜜祭祀' },
  { name: '茶水', desc: '清香茶水，静心供奉' },
  { name: '美酒', desc: '陈年美酒，敬献先人' },
  { name: '纸钱', desc: '传统纸钱，焚化供奉' },
  { name: '金元宝', desc: '金色元宝，寄托祝愿' },
  { name: '银元宝', desc: '银色元宝，福佑安康' },
  { name: '冥币', desc: '冥界货币，供奉使用' },
  { name: '纸扎房屋', desc: '精美纸房，安居乐业' },
  { name: '莲花灯', desc: '莲花灯盏，照亮前程' },
  { name: '长明灯', desc: '长明灯火，永不熄灭' },
  { name: '供桌', desc: '实木供桌，庄重供奉' },
  { name: '花瓶', desc: '精美花瓶，插花用品' },
  { name: '数字相册', desc: 'NFT数字相册，永久保存' },
  { name: '音乐盒', desc: '纪念音乐盒，回忆旋律' },
  { name: '照片墙', desc: '照片展示墙，记录时光' },
  { name: '清洁服务', desc: '墓地清洁，保持整洁' },
  { name: '维护服务', desc: '定期维护，长久保养' },
  { name: '代祭服务', desc: '代为祭祀，传递思念' },
  { name: '桃花供品', desc: '粉色桃花，春意盎然' },
  { name: '梅花供品', desc: '傲雪梅花，高洁品格' },
  { name: '兰花供品', desc: '幽香兰花，清雅脱俗' },
  { name: '荷花供品', desc: '出淤泥而不染的荷花' },
  { name: '牡丹供品', desc: '富贵牡丹，雍容华贵' },
  { name: '菊花茶', desc: '清香菊花茶，静心养神' },
  { name: '素斋饭', desc: '清淡素斋，表达虔诚' },
  { name: '三牲供品', desc: '传统三牲，隆重祭祀' },
  { name: '五果供品', desc: '五种水果，丰盛供奉' },
  { name: '佛经', desc: '佛门经文，超度亡灵' },
  { name: '道经', desc: '道家经典，祈福安宁' },
  { name: '十字架', desc: '基督教十字架，神圣象征' },
  { name: '念珠', desc: '佛教念珠，诚心祈祷' },
  { name: '风铃', desc: '清脆风铃，随风而响' },
  { name: '香包', desc: '香囊香包，芬芳四溢' },
  { name: '丝带花', desc: '彩色丝带花，装饰用品' },
  { name: '许愿灯', desc: '许愿灯笼，寄托心愿' },
  { name: '纪念徽章', desc: '定制徽章，永久纪念' },
  { name: '刻字石碑', desc: '刻字小石碑，留名纪念' },
  { name: '环保祭品', desc: '环保材料祭品，绿色祭祀' },
];

// 主分类（0-8）
const PRIMARY_CATEGORIES = {
  Flowers: 0,             // 鲜花类
  Incense: 1,             // 香烛类
  Foods: 2,               // 食品供品
  PaperMoney: 3,          // 纸钱冥币
  PersonalItems: 4,       // 个人用品
  TraditionalOfferings: 5,// 传统祭品
  ModernMemorials: 6,     // 现代纪念品
  DigitalMemorials: 7,    // 数字纪念品
  Services: 8,            // 服务类
};

// 子分类（根据主分类而定，这里简化为 0-9）
const SUB_CATEGORIES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

// 品质等级（0-4）
const QUALITY_LEVELS = {
  Basic: 0,      // 基础
  Standard: 1,   // 标准
  Premium: 2,    // 优质
  Luxury: 3,     // 奢华
  Ultimate: 4,   // 至尊
};

// 媒体Schema CID库（示例IPFS CID）
const MEDIA_SCHEMA_CIDS = [
  'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
  'QmPZ9gcCEpqKTo6aq61g2nXGUhM4iCL3ewB6LDXZCtioEB',
  'QmYCvbfNbCwFR45HiNP45rwJgvatpiW38D961L5qAhUM5Y',
  'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco',
  'QmZTR5bcpQD7cFgTorqxZDYaew1Wqgfbd2ud9QqGPAkK2V',
];

/**
 * 函数级详细中文注释：格式化余额显示
 */
function formatBalance(raw, decimals, symbol) {
  const value = BigInt(raw.toString());
  const base = 10n ** BigInt(decimals);
  const integer = value / base;
  const fraction = value % base;
  const fractionStr = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
  if (fractionStr.length === 0) {
    return `${integer.toString()} ${symbol}`;
  }
  return `${integer.toString()}.${fractionStr.slice(0, 6)} ${symbol}`;
}

/**
 * 函数级详细中文注释：生成随机祭祀品参数
 *
 * @param {number} index 祭祀品索引
 * @returns {object} 祭祀品参数
 */
function generateRandomSacrifice(index) {
  // 循环使用祭祀品数据
  const data = SACRIFICE_DATA[index % SACRIFICE_DATA.length];

  // 随机选择主分类
  const primaryCategoryKeys = Object.keys(PRIMARY_CATEGORIES);
  const primaryCategoryKey = primaryCategoryKeys[Math.floor(Math.random() * primaryCategoryKeys.length)];
  const primaryCategory = PRIMARY_CATEGORIES[primaryCategoryKey];

  // 随机选择子分类
  const subCategory = SUB_CATEGORIES[Math.floor(Math.random() * SUB_CATEGORIES.length)];

  // 随机选择品质等级
  const qualityLevelKeys = Object.keys(QUALITY_LEVELS);
  const qualityLevelKey = qualityLevelKeys[Math.floor(Math.random() * qualityLevelKeys.length)];
  const qualityLevel = QUALITY_LEVELS[qualityLevelKey];

  // 随机选择资源URL（IPFS CID）
  const resourceUrl = MEDIA_SCHEMA_CIDS[Math.floor(Math.random() * MEDIA_SCHEMA_CIDS.length)];

  // 根据品质等级设置价格（1 DUST = 10^12）
  const basePrices = {
    0: 10_000_000_000_000,    // 10 DUST
    1: 50_000_000_000_000,    // 50 DUST
    2: 100_000_000_000_000,   // 100 DUST
    3: 500_000_000_000_000,   // 500 DUST
    4: 1_000_000_000_000_000, // 1000 DUST
  };
  const price = basePrices[qualityLevel] * (1 + Math.random() * 0.5); // ±50% 随机浮动

  // 随机库存（70%无限库存，30%有限库存）
  const stock = Math.random() < 0.7 ? -1 : Math.floor(Math.random() * 1000) + 10;

  // 随机每用户限购（50%无限制，50%有限制）
  const perUserLimit = Math.random() < 0.5 ? null : Math.floor(Math.random() * 10) + 1;

  // 随机季节性（20%季节性商品）
  const seasonal = Math.random() < 0.2;

  return {
    name: data.name,
    description: data.desc,
    resourceUrl,
    primaryCategory,
    primaryCategoryName: primaryCategoryKey,
    subCategory,
    price: Math.floor(price),
    stock,
    perUserLimit,
    qualityLevel,
    qualityLevelName: qualityLevelKey,
    seasonal,
  };
}

/**
 * 函数级详细中文注释：创建祭祀品
 */
async function createSacrifice(api, signer, params, index, total, decimals, symbol) {
  console.log(`\n[${index}/${total}] 创建祭祀品`);
  console.log(`   名称: ${params.name}`);
  console.log(`   描述: ${params.description}`);
  console.log(`   主分类: ${params.primaryCategoryName} (${params.primaryCategory})`);
  console.log(`   子分类: ${params.subCategory}`);
  console.log(`   品质: ${params.qualityLevelName} (${params.qualityLevel})`);
  console.log(`   价格: ${formatBalance(params.price, decimals, symbol)}`);
  console.log(`   库存: ${params.stock === -1 ? '无限' : params.stock}`);
  console.log(`   限购: ${params.perUserLimit || '无限制'}`);
  console.log(`   季节性: ${params.seasonal ? '是' : '否'}`);

  try {
    // 使用 sudo 权限调用 pallet-memorial 的 create_sacrifice
    const innerTx = api.tx.memorial.createSacrifice(
      params.name,
      params.description,
      params.resourceUrl,
      params.primaryCategory,
      params.subCategory,
      params.price,
      params.stock,
      params.perUserLimit,
      params.qualityLevel,
      params.seasonal
    );

    const tx = api.tx.sudo.sudo(innerTx);

    // 预估手续费
    const { partialFee } = await tx.paymentInfo(signer);
    console.log(`   预估手续费: ${formatBalance(partialFee, decimals, symbol)}`);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('交易超时（60秒）'));
      }, 60000);

      tx.signAndSend(signer, result => {
        const { status, dispatchError, events } = result;

        if (status.isReady) {
          console.log('   📦 状态: Ready');
        }

        if (status.isBroadcast) {
          console.log('   📡 已广播');
        }

        if (status.isInBlock) {
          console.log(`   ✅ 包含区块: ${status.asInBlock.toHex().slice(0, 10)}...`);
        }

        if (dispatchError) {
          clearTimeout(timeout);
          if (dispatchError.isModule) {
            const meta = api.registry.findMetaError(dispatchError.asModule);
            const errorMessage = `${meta.section}.${meta.name}: ${meta.docs.join(' ')}`;
            console.error(`   ❌ 创建失败: ${errorMessage}`);
            reject(new Error(errorMessage));
          } else {
            console.error('   ❌ 创建失败:', dispatchError.toString());
            reject(new Error(dispatchError.toString()));
          }
          return;
        }

        if (status.isFinalized) {
          clearTimeout(timeout);
          console.log(`   🎉 最终确认: ${status.asFinalized.toHex().slice(0, 10)}...`);

          // 查找创建事件
          const sacrificeEvent = events.find(({ event }) =>
            event.section === 'memorial' && event.method === 'SacrificeCreated'
          );

          if (sacrificeEvent) {
            console.log('   ✅ 祭祀品创建成功！');
          }

          resolve({
            success: true,
            blockHash: status.asFinalized.toHex(),
            fee: partialFee.toString()
          });
        }
      }).catch(err => {
        clearTimeout(timeout);
        console.error('   ❌ 发送失败:', err.message);
        reject(err);
      });
    });
  } catch (error) {
    console.error(`   ❌ 创建失败: ${error.message}`);
    throw error;
  }
}

/**
 * 函数级详细中文注释：主函数
 */
async function main() {
  console.log('🚀 创建祭祀品脚本启动\n');
  console.log('='.repeat(60));
  console.log('配置信息:');
  console.log(`   祭祀品数量: ${CREATE_CONFIG.sacrificeCount}`);
  console.log(`   管理员地址: ${ADMIN_CONFIG.expectedAddress}`);
  console.log('='.repeat(60));
  
  try {
    // 1. 等待加密库准备就绪
    await cryptoWaitReady();
    console.log('\n✅ 加密库准备完成');

    // 2. 创建管理员账户密钥对
    const keyring = new Keyring({ type: 'sr25519' });
    const adminPair = keyring.addFromUri(ADMIN_CONFIG.uri);
    
    // 3. 验证地址
    if (adminPair.address !== ADMIN_CONFIG.expectedAddress) {
      console.error('❌ 地址验证失败');
      console.error(`   期望: ${ADMIN_CONFIG.expectedAddress}`);
      console.error(`   实际: ${adminPair.address}`);
      process.exit(1);
    }
    console.log('✅ 管理员账户地址验证通过');
    console.log(`   地址: ${adminPair.address}`);

    // 4. 连接到链节点
    console.log(`\n🔌 正在连接节点: ${DEFAULT_WS_ENDPOINT}`);
    const api = await ApiPromise.create({ 
      provider: new WsProvider(DEFAULT_WS_ENDPOINT) 
    });

    // 5. 获取链信息
    const [chain, nodeName, nodeVersion] = await Promise.all([
      api.rpc.system.chain(),
      api.rpc.system.name(),
      api.rpc.system.version(),
    ]);
    
    const decimals = api.registry.chainDecimals?.[0] ?? 12;
    const symbol = api.registry.chainTokens?.[0] ?? 'MEMO';
    
    console.log(`✅ 已连接 ${chain.toHuman()} • ${nodeName.toHuman()} v${nodeVersion.toHuman()}`);
    console.log(`   代币: ${symbol} (精度: ${decimals})`);

    // 6. 检查管理员账户余额
    console.log('\n💰 检查账户余额...');
    const { data: balanceData } = await api.query.system.account(adminPair.address);
    const freeBalance = balanceData.free;
    console.log(`   可用余额: ${formatBalance(freeBalance, decimals, symbol)}`);

    // 7. 生成祭祀品列表
    console.log('\n📋 生成祭祀品列表...');
    console.log('='.repeat(60));

    const sacrifices = [];
    for (let i = 0; i < CREATE_CONFIG.sacrificeCount; i++) {
      const sacrifice = generateRandomSacrifice(i);
      sacrifices.push(sacrifice);
    }

    console.log(`✅ 生成 ${sacrifices.length} 个祭祀品`);

    // 统计各分类数量
    const categoryCounts = {};
    sacrifices.forEach(s => {
      categoryCounts[s.primaryCategoryName] = (categoryCounts[s.primaryCategoryName] || 0) + 1;
    });
    console.log('\n📊 分类统计:');
    Object.entries(categoryCounts).forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count} 个`);
    });

    // 8. 预估总手续费
    const testInnerTx = api.tx.memorial.createSacrifice(
      sacrifices[0].name,
      sacrifices[0].description,
      sacrifices[0].resourceUrl,
      sacrifices[0].primaryCategory,
      sacrifices[0].subCategory,
      sacrifices[0].price,
      sacrifices[0].stock,
      sacrifices[0].perUserLimit,
      sacrifices[0].qualityLevel,
      sacrifices[0].seasonal
    );

    const testTx = api.tx.sudo.sudo(testInnerTx);
    const { partialFee } = await testTx.paymentInfo(adminPair);
    const estimatedFees = partialFee.toBigInt() * BigInt(sacrifices.length);
    console.log(`\n预估总手续费: ${formatBalance(estimatedFees, decimals, symbol)}`);
    console.log(`单笔手续费: ${formatBalance(partialFee, decimals, symbol)}`);
    
    // 9. 余额检查
    if (freeBalance.toBigInt() < estimatedFees) {
      console.error('\n❌ 余额不足！');
      console.error(`   可用: ${formatBalance(freeBalance, decimals, symbol)}`);
      console.error(`   需要: ${formatBalance(estimatedFees, decimals, symbol)}`);
      await api.disconnect();
      process.exit(1);
    }
    
    console.log('✅ 余额充足');
    
    // 10. 确认提示
    console.log('\n⚠️  准备开始创建祭祀品');
    console.log('   按 Ctrl+C 取消，或等待 3 秒自动开始...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 11. 开始批量创建
    console.log('\n🎯 开始创建祭祀品...');
    console.log('='.repeat(60));

    const results = [];
    let successCount = 0;
    let failCount = 0;
    let totalFees = 0n;

    for (let i = 0; i < sacrifices.length; i++) {
      const sacrifice = sacrifices[i];

      try {
        const result = await createSacrifice(
          api,
          adminPair,
          sacrifice,
          i + 1,
          sacrifices.length,
          decimals,
          symbol
        );

        results.push({
          ...sacrifice,
          success: true,
          blockHash: result.blockHash,
          fee: result.fee,
        });

        totalFees += BigInt(result.fee);
        successCount++;

        // 创建间延迟
        if (i < sacrifices.length - 1) {
          await new Promise(resolve => setTimeout(resolve, CREATE_CONFIG.delayBetweenCreations));
        }

      } catch (error) {
        console.error(`   ❌ 创建失败: ${error.message}`);

        results.push({
          ...sacrifice,
          success: false,
          error: error.message,
        });

        failCount++;
      }
    }
    
    // 12. 显示最终结果
    console.log('\n' + '='.repeat(60));
    console.log('📊 创建完成');
    console.log('='.repeat(60));
    console.log(`✅ 成功: ${successCount} 个`);
    console.log(`❌ 失败: ${failCount} 个`);
    console.log(`📝 总计: ${sacrifices.length} 个`);
    console.log(`📈 成功率: ${((successCount / sacrifices.length) * 100).toFixed(2)}%`);

    // 13. 显示失败的祭祀品
    if (failCount > 0) {
      console.log(`\n❌ 失败的祭祀品:`);
      results.filter(r => !r.success).forEach(r => {
        console.log(`   - ${r.name}: ${r.error}`);
      });
    }
    
    // 15. 显示最终余额
    console.log('\n💰 最终余额查询...');
    const { data: finalBalanceData } = await api.query.system.account(adminPair.address);
    const finalBalance = finalBalanceData.free;
    const spent = freeBalance.toBigInt() - finalBalance.toBigInt();
    
    console.log(`   初始余额: ${formatBalance(freeBalance, decimals, symbol)}`);
    console.log(`   最终余额: ${formatBalance(finalBalance, decimals, symbol)}`);
    console.log(`   实际花费: ${formatBalance(spent, decimals, symbol)}`);
    console.log(`   平均手续费: ${formatBalance(spent / BigInt(successCount || 1), decimals, symbol)}`);
    
    // 16. 保存结果到文件
    const fs = require('fs');
    const path = require('path');
    const resultFile = path.join(__dirname, 'create-sacrifices-result.json');

    fs.writeFileSync(resultFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        total: sacrifices.length,
        success: successCount,
        failed: failCount,
        successRate: ((successCount / sacrifices.length) * 100).toFixed(2) + '%',
        totalFees: totalFees.toString(),
        totalFeesFormatted: formatBalance(totalFees, decimals, symbol),
      },
      results,
    }, null, 2));

    console.log(`\n💾 结果已保存到: ${resultFile}`);
    
    // 17. 断开连接
    await api.disconnect();
    console.log('\n👋 脚本执行完成');
    
    process.exit(failCount > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('\n❌ 发生错误:', error.message);
    console.error('\n堆栈跟踪:');
    console.error(error.stack);
    process.exit(1);
  }
}

// 执行主函数
main().catch(error => {
  console.error('❌ 未捕获的错误:', error);
  process.exit(1);
});

