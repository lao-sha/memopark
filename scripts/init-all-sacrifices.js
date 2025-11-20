const fs = require('fs');
const path = require('path');
const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { cryptoWaitReady } = require('@polkadot/util-crypto');

const CATEGORY_MAP = {
  'xiangzhu': 1, 'huaguo': 0, 'jiucai': 2, 'jiajuqiche': 4,
  'bieshuyongren': 4, 'fushimingbiao': 4, 'shumayueqi': 4,
  'jieri': 2, 'wanjuchongwu': 3, 'yundong': 3, 'taocan': 4
};

function yuanToDUST(yuan) {
  return BigInt(yuan) * BigInt(1_000_000_000_000_000);
}

async function signAndSend(api, tx, signer) {
  return new Promise(async (resolve, reject) => {
    try {
      const unsub = await tx.signAndSend(signer, ({ status, dispatchError }) => {
        if (status.isFinalized) {
          if (dispatchError) {
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              reject(new Error(`${decoded.section}.${decoded.name}`));
            } else {
              reject(new Error(dispatchError.toString()));
            }
            unsub();
          } else {
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

async function main() {
  console.log('🚀 开始初始化所有供奉品（使用合并数据）\n');
  
  await cryptoWaitReady();
  const wsProvider = new WsProvider('ws://127.0.0.1:9944');
  const api = await ApiPromise.create({ provider: wsProvider });
  
  const keyring = new Keyring({ type: 'sr25519' });
  const admin = keyring.addFromUri('//Alice');
  
  const dataPath = path.join(__dirname, 'offerings-merged.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  
  console.log(`📦 总共 ${data.meta.totalCount} 个供奉品\n`);
  
  let successCount = 0;
  let failCount = 0;
  const startTime = Date.now();
  
  for (let i = 0; i < data.offerings.length; i++) {
    const item = data.offerings[i];
    
    try {
      const resourceUrl = item.imageUrl || `bafybei${Buffer.from(`${item.name}-${i}`).toString('hex').substring(0, 50)}`;
      const description = `${item.icon || ''} ${item.name}`;
      const scene = 3; // Memorial
      const categoryCode = CATEGORY_MAP[item.category] || 4;
      
      const price = Number(item.price || 0);
      let fixedPrice = null;
      let unitPricePerWeek = null;
      let isVipExclusive = false;
      
      if (price === 0) {
        fixedPrice = 0;
      } else if (price >= 10) {
        isVipExclusive = true;
        unitPricePerWeek = yuanToDUST(price).toString();
      } else {
        fixedPrice = yuanToDUST(price).toString();
      }
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const avg = successCount > 0 ? (elapsed / successCount).toFixed(1) : '?';
      const eta = successCount > 0 ? ((data.offerings.length - i) * (elapsed / successCount) / 60).toFixed(1) : '?';
      
      process.stdout.write(`[${i + 1}/${data.offerings.length}] ${item.icon || ''} ${item.name.padEnd(18)} ${price}元 (${avg}s/个, 剩${eta}分钟) ...`);
      
      const createTx = api.tx.memorial.createSacrifice(
        item.name,
        resourceUrl,
        description,
        isVipExclusive,
        fixedPrice,
        unitPricePerWeek,
        scene,
        categoryCode
      );
      
      const tx = api.tx.sudo.sudo(createTx);
      await signAndSend(api, tx, admin);
      
      console.log(` ✅`);
      successCount++;
      
    } catch (error) {
      console.log(` ❌ ${error.message}`);
      failCount++;
    }
  }
  
  const totalTime = ((Date.now() - startTime) / 60000).toFixed(2);
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`✨ 完成！`);
  console.log(`${'='.repeat(80)}`);
  console.log(`✅ 成功: ${successCount} 个`);
  console.log(`❌ 失败: ${failCount} 个`);
  console.log(`⏱️  总耗时: ${totalTime} 分钟`);
  console.log(`📈 平均速度: ${(successCount / (Date.now() - startTime) * 1000).toFixed(2)} 个/秒\n`);
  
  await api.disconnect();
}

main().catch(console.error);
