/**
 * 函数级详细中文注释：Stardust 祭祀品目录初始化脚本
 * 
 * 用途：
 * - 从云上思念网站提取的供奉品数据创建链端祭祀品目录（SacrificeItem）
 * - 支持批量导入500+种供奉品
 * - 按照11个类别组织供奉品
 * 
 * 使用方法：
 * 1. 确保链已启动
 * 2. 运行: node scripts/init-sacrifices.js
 * 3. 需要管理员账户权限
 * 
 * 数据来源：
 * - offerings-data.json（从云上思念网站提取）
 */

const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { cryptoWaitReady } = require('@polkadot/util-crypto');
const fs = require('fs');
const path = require('path');

/**
 * 函数级详细中文注释：场景枚举映射
 * 对应链端 Scene 枚举
 */
const SCENE_MAP = {
  'Grave': 0,      // 墓地场景
  'Pet': 1,        // 宠物场景
  'Park': 2,       // 公园场景
  'Memorial': 3    // 纪念馆场景
};

/**
 * 函数级详细中文注释：类目枚举映射
 * 对应链端 Category 枚举
 */
const CATEGORY_MAP = {
  'xiangzhu': 1,      // 香烛 -> Candle
  'huaguo': 0,        // 花果 -> Flower
  'jiucai': 2,        // 酒菜 -> Food
  'jiajuqiche': 4,    // 家居汽车 -> Other
  'bieshuyongren': 4, // 别墅佣人 -> Other
  'fushimingbiao': 4, // 服饰名表 -> Other
  'shumayueqi': 4,    // 数码乐器 -> Other
  'jieri': 2,         // 节日 -> Food
  'wanjuchongwu': 3,  // 玩具宠物 -> Toy
  'yundong': 3,       // 运动 -> Toy
  'taocan': 4         // 套餐 -> Other
};

/**
 * 函数级详细中文注释：价格转换（元 -> DUST）
 * 1 元 = 1,000,000,000,000,000 最小单位（15个0）
 */
function yuanToDUST(yuan) {
  return BigInt(yuan) * BigInt(1_000_000_000_000_000);
}

/**
 * 函数级详细中文注释：主函数 - 初始化所有祭祀品
 */
async function main() {
  console.log('🚀 开始初始化 Stardust 祭祀品目录...\n');

  // 加载供奉品数据
  const dataPath = path.join(__dirname, 'offerings-data.json');
  const offeringsData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  console.log(`📦 数据来源: ${offeringsData.meta.source}`);
  console.log(`📅 提取日期: ${offeringsData.meta.extractDate}`);
  console.log(`📊 供奉品类别: ${offeringsData.categories.length} 个`);
  console.log(`📊 供奉品总数: 约 ${offeringsData.meta.totalCount} 个\n`);

  // 等待加密库就绪
  await cryptoWaitReady();

  // 连接到本地节点
  const wsProvider = new WsProvider('ws://127.0.0.1:9944');
  const api = await ApiPromise.create({ provider: wsProvider });

  console.log(`✅ 已连接到链: ${(await api.rpc.system.chain()).toString()}`);
  console.log(`📦 Runtime 版本: ${api.runtimeVersion.specVersion.toString()}\n`);

  // 创建管理员账户（使用 Alice 作为示例）
  const keyring = new Keyring({ type: 'sr25519' });
  const admin = keyring.addFromUri('//Alice');
  console.log(`👤 管理员账户: ${admin.address}\n`);

  // 获取管理员余额
  const { data: { free: balance } } = await api.query.system.account(admin.address);
  console.log(`💰 管理员余额: ${balance.toHuman()}\n`);

  // 统计信息
  let totalCreated = 0;
  let totalFailed = 0;
  const stats = {};

  console.log('=' .repeat(80));
  console.log('开始创建祭祀品目录');
  console.log('=' .repeat(80) + '\n');

  // 遍历所有类别
  for (const offering of offeringsData.offerings) {
    const category = offering.category;
    const categoryName = offeringsData.categories.find(c => c.code === category)?.name || category;
    const items = offering.items;

    console.log(`\n📁 类别: ${categoryName} (${category}) - ${items.length} 个供品`);
    console.log('-'.repeat(80));

    stats[category] = { total: items.length, success: 0, failed: 0 };

    // 遍历该类别下的所有供品
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      try {
        await createSacrifice(api, admin, item, category, i);
        totalCreated++;
        stats[category].success++;
      } catch (error) {
        console.error(`   ❌ 创建失败: ${error.message}`);
        totalFailed++;
        stats[category].failed++;
      }
    }

    console.log(`   ✅ ${categoryName}: ${stats[category].success}/${stats[category].total} 成功`);
  }

  console.log('\n' + '=' .repeat(80));
  console.log('✨ 祭祀品目录创建完成！');
  console.log('=' .repeat(80));
  console.log(`📊 总计: ${totalCreated + totalFailed} 个供品`);
  console.log(`✅ 成功: ${totalCreated} 个`);
  console.log(`❌ 失败: ${totalFailed} 个`);
  console.log(`📈 成功率: ${((totalCreated / (totalCreated + totalFailed)) * 100).toFixed(2)}%\n`);

  // 显示各类别统计
  console.log('📋 分类统计:');
  console.log('-'.repeat(80));
  for (const [catCode, stat] of Object.entries(stats)) {
    const categoryName = offeringsData.categories.find(c => c.code === catCode)?.name || catCode;
    console.log(`   ${categoryName.padEnd(12)} : ${stat.success.toString().padStart(3)}/${stat.total.toString().padStart(3)} (${((stat.success / stat.total) * 100).toFixed(1).padStart(5)}%)`);
  }

  // 查询并显示创建的祭祀品总数
  console.log('\n' + '=' .repeat(80));
  const nextId = await api.query.memorial.nextSacrificeId();
  console.log(`🎯 链上祭祀品总数: ${nextId.toNumber() - 1} 个`);
  console.log('=' .repeat(80) + '\n');

  // 断开连接
  await api.disconnect();
  console.log('✅ 脚本执行完成，已断开连接\n');
}

/**
 * 函数级详细中文注释：创建单个祭祀品
 * @param {ApiPromise} api - Polkadot.js API 实例
 * @param {KeyringPair} admin - 管理员账户
 * @param {Object} item - 供品数据
 * @param {string} category - 类别代码
 * @param {number} index - 索引
 */
async function createSacrifice(api, admin, item, category, index) {
  const name = item.name;
  const price = item.price;
  const icon = item.icon;

  // 生成资源 URL（模拟 IPFS CID）
  const resourceUrl = `bafybei${Buffer.from(`${category}-${name}-${index}`).toString('hex').substring(0, 50)}`;
  
  // 描述
  const description = `${icon} ${name} - ${price === 0 ? '免费' : price + '元'}`;

  // 确定场景（默认使用 Memorial）
  const scene = SCENE_MAP['Memorial'];

  // 确定类目
  const categoryCode = CATEGORY_MAP[category] || 4; // 默认 Other

  // 确定定价策略
  let fixedPrice = null;
  let unitPricePerWeek = null;
  let isVipExclusive = false;

  if (price === 0) {
    // 免费供品：固定价格为 0
    fixedPrice = 0;
  } else if (price >= 10) {
    // 高价供品：设为 VIP 专属，且按周计费
    isVipExclusive = true;
    unitPricePerWeek = yuanToDUST(price).toString();
  } else {
    // 普通供品：固定价格
    fixedPrice = yuanToDUST(price).toString();
  }

  // 输出简化信息
  process.stdout.write(`   ${(index + 1).toString().padStart(3)}. ${icon} ${name.padEnd(16)} ${price.toString().padStart(3)}元 ...`);

  try {
    // 创建祭祀品
    const createTx = api.tx.memorial.createSacrifice(
      name,
      resourceUrl,
      description,
      isVipExclusive,
      fixedPrice,
      unitPricePerWeek,
      scene,
      categoryCode
    );
    
    // 使用 Sudo 权限包装（createSacrifice 需要 AdminOrigin）
    const tx = api.tx.sudo.sudo(createTx);

    await signAndSend(api, tx, admin);
    console.log(` ✅`);

  } catch (error) {
    console.log(` ❌`);
    throw error;
  }
}

/**
 * 函数级详细中文注释：签名并发送交易
 * @param {ApiPromise} api - Polkadot.js API 实例
 * @param {SubmittableExtrinsic} tx - 待签名的交易
 * @param {KeyringPair} signer - 签名账户
 */
async function signAndSend(api, tx, signer) {
  return new Promise(async (resolve, reject) => {
    try {
      const unsub = await tx.signAndSend(signer, ({ status, events, dispatchError }) => {
        // 交易已上链并最终确认
        if (status.isFinalized) {
          // 检查是否有错误
          if (dispatchError) {
            let errorInfo = '';
            
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              errorInfo = `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`;
            } else {
              errorInfo = dispatchError.toString();
            }

            unsub();
            reject(new Error(errorInfo));
          } else {
            // 交易成功
            unsub();
            resolve();
          }
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

// 运行主函数
main()
  .catch((error) => {
    console.error('\n❌ 脚本执行失败:', error);
    process.exit(1);
  });

