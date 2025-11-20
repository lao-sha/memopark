// 测试版本：只初始化前20个供奉品
const fs = require('fs');
const path = require('path');
const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { cryptoWaitReady } = require('@polkadot/util-crypto');

const SCENE_MAP = { 'Grave': 0, 'Pet': 1, 'Park': 2, 'Memorial': 3 };
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
            let errorInfo = '';
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              errorInfo = `${decoded.section}.${decoded.name}`;
            } else {
              errorInfo = dispatchError.toString();
            }
            unsub();
            reject(new Error(errorInfo));
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
  console.log('🚀 测试版：初始化前20个供奉品\n');
  
  await cryptoWaitReady();
  const wsProvider = new WsProvider('ws://127.0.0.1:9944');
  const api = await ApiPromise.create({ provider: wsProvider });
  
  const keyring = new Keyring({ type: 'sr25519' });
  const admin = keyring.addFromUri('//Alice');
  
  const dataPath = path.join(__dirname, 'offerings-with-images.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  
  // 只取前20个
  const testOfferings = data.offerings.slice(0, 20);
  
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < testOfferings.length; i++) {
    const item = testOfferings[i];
    
    try {
      const resourceUrl = `bafybei${Buffer.from(`${item.name}-${i}`).toString('hex').substring(0, 50)}`;
      const description = `${item.icon || ''} ${item.name} - ${item.price === '0' ? '免费' : item.price + '元'}`;
      const scene = SCENE_MAP['Memorial'];
      const categoryCode = 1; // 全部使用 Candle 类别测试
      
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
      
      process.stdout.write(`${(i + 1).toString().padStart(2)}. ${item.name.padEnd(20)} ${price}元 ...`);
      
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
      
      // 使用 Sudo 权限包装（createSacrifice 需要 AdminOrigin）
      const tx = api.tx.sudo.sudo(createTx);
      
      await signAndSend(api, tx, admin);
      console.log(` ✅`);
      successCount++;
      
    } catch (error) {
      console.log(` ❌ ${error.message}`);
      failCount++;
    }
  }
  
  console.log(`\n✨ 完成！成功: ${successCount}, 失败: ${failCount}\n`);
  
  await api.disconnect();
}

main().catch(console.error);
