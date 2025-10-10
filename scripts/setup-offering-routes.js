#!/usr/bin/env node
/**
 * 函数级详细中文注释：供奉路由表配置脚本（包含 SubjectFunding）
 * 
 * 功能：通过 Sudo 权限配置供奉分账路由表
 * 
 * 默认配置（2024-10-10 调整版，总计 100%）：
 * - SubjectFunding 2% (kind=0) → 主题账户（基于 creator 派生，给逝者家属）
 * - Burn 3% (kind=2) → 销毁（通缩机制）
 * - Treasury 3% (kind=3) → 国库（平台运营）
 * - Decentralized storage fee 2% (kind=1) → 去中心化存储账户
 * - Affiliate 90% (kind=1) → 推荐分配（强激励推荐网络）
 * 
 * 调整说明：
 * - 大幅提升推荐激励：80% → 90% (+10%)
 * - 削减家属资金：10% → 2% (-8%)
 * - 削减销毁：5% → 3% (-2%)
 * 
 * 使用方法：
 * 1. 确保节点运行：./target/release/memopark-node --dev --tmp
 * 2. 运行脚本：node scripts/setup-offering-routes.js
 * 3. 使用 Alice 账户（//Alice）提交 Sudo 交易
 */

const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { blake2AsHex } = require('@polkadot/util-crypto');

// 配置
const WS_URL = 'ws://127.0.0.1:9944';
const SUDO_SEED = '//Alice'; // Sudo 账户

// 路由表配置（2024-10-10 调整版）
const ROUTES = [
    {
        kind: 0, // SubjectFunding
        account: null,
        share: 20000, // 2% (Permill: 20000/1000000) - 从 10% 降到 2%
        name: 'SubjectFunding',
        desc: '主题账户（基于 creator 派生，给逝者家属）'
    },
    {
        kind: 2, // Burn
        account: null,
        share: 30000, // 3% - 从 5% 降到 3%（通缩机制）
        name: 'Burn',
        desc: '销毁'
    },
    {
        kind: 3, // Treasury
        account: null,
        share: 30000, // 3% - 保持不变（平台运营）
        name: 'Treasury',
        desc: '国库'
    },
    {
        kind: 1, // SpecificAccount (Decentralized storage)
        account: 'STORAGE_ACCOUNT', // 占位符，实际需要替换
        share: 20000, // 2% - 保持不变（IPFS 存储）
        name: 'Decentralized storage fee',
        desc: '去中心化存储费用 (IPFS + 未来扩展)'
    },
    {
        kind: 1, // SpecificAccount (Affiliate)
        account: 'AFFILIATE_ESCROW_ACCOUNT', // 占位符，实际需要替换
        share: 900000, // 90% - 从 80% 升到 90%（强激励推荐网络）
        name: 'Affiliate',
        desc: '推荐分配'
    }
];

// PalletId 派生函数
function palletIdToAccount(palletId, ss58Format = 42) {
    const { encodeAddress, blake2AsU8a } = require('@polkadot/util-crypto');
    const { stringToU8a, u8aConcat } = require('@polkadot/util');
    
    // 拼接: "modl" + palletId
    const data = u8aConcat(stringToU8a('modl'), stringToU8a(palletId));
    // 填充到 32 字节
    const padded = new Uint8Array(32);
    padded.set(data.slice(0, 32));
    // Blake2-256 哈希
    const hash = blake2AsU8a(padded, 256);
    // 编码为 SS58 地址
    return encodeAddress(hash, ss58Format);
}

async function main() {
    console.log('🚀 开始配置供奉路由表（包含 SubjectFunding）...\n');

    // 连接节点
    const provider = new WsProvider(WS_URL);
    const api = await ApiPromise.create({ provider });
    
    console.log('✅ 已连接到节点');
    console.log(`   链名称: ${await api.rpc.system.chain()}`);
    console.log(`   节点版本: ${await api.rpc.system.version()}\n`);

    // 派生账户地址
    const storageAccount = palletIdToAccount('py/storg');
    const affiliateAccount = palletIdToAccount('affiliat');
    
    console.log('📍 账户地址:');
    console.log(`   存储账户 (py/storg):  ${storageAccount}`);
    console.log(`   联盟托管 (affiliat):  ${affiliateAccount}\n`);

    // 替换占位符
    const routes = ROUTES.map(r => {
        if (r.account === 'STORAGE_ACCOUNT') {
            return { ...r, account: storageAccount };
        }
        if (r.account === 'AFFILIATE_ESCROW_ACCOUNT') {
            return { ...r, account: affiliateAccount };
        }
        return r;
    });

    // 显示路由表配置
    console.log('📋 路由表配置:');
    let totalPermill = 0;
    routes.forEach((r, i) => {
        const kindName = ['SubjectFunding', 'SpecificAccount', 'Burn', 'Treasury'][r.kind] || 'Unknown';
        const percent = (r.share / 10000).toFixed(2);
        const target = r.account || '(系统账户)';
        console.log(`   ${i + 1}. ${kindName.padEnd(20)} ${percent.padStart(5)}%  →  ${target}`);
        totalPermill += r.share;
    });
    console.log(`\n${totalPermill === 1000000 ? '✓' : '✗'} 总计: ${(totalPermill / 10000).toFixed(2)}% (${totalPermill}/1000000)\n`);

    if (totalPermill !== 1000000) {
        console.warn(`⚠️  警告: 总和不等于100%，请检查配置！`);
    }

    // 检查API是否有这个调用
    if (!api.tx.memoOfferings || !api.tx.memoOfferings.setRouteTableGlobal) {
        console.error('❌ API中未找到 memoOfferings.setRouteTableGlobal 方法');
        console.error('   可能的原因:');
        console.error('   1. Runtime未包含此方法（检查pallet配置）');
        console.error('   2. 方法名称不匹配');
        console.error('   3. 需要重新编译Runtime');
        console.log('\n可用的 memoOfferings 方法:');
        console.log(Object.keys(api.tx.memoOfferings || {}));
        process.exit(1);
    }

    // 创建治理调用
    const callArgs = routes.map(r => [r.kind, r.account, r.share]);
    const innerCall = api.tx.memoOfferings.setRouteTableGlobal(callArgs);
    const sudoTx = api.tx.sudo.sudo(innerCall);

    console.log('📝 交易信息:');
    console.log(`   模块: memoOfferings`);
    console.log(`   方法: setRouteTableGlobal`);
    console.log(`   权限: sudo (需要 Root 权限)\n`);

    // 签名并发送
    const keyring = new Keyring({ type: 'sr25519' });
    const sudoAccount = keyring.addFromUri(SUDO_SEED);

    console.log(`🔐 使用账户: ${sudoAccount.address}`);
    console.log('⏳ 正在提交交易...\n');

    return new Promise((resolve, reject) => {
        sudoTx.signAndSend(sudoAccount, ({ status, events }) => {
            if (status.isInBlock) {
                console.log(`✅ 交易已打包到区块: ${status.asInBlock.toHex()}`);
                
                // 检查事件
                events.forEach(({ event }) => {
                    const { section, method, data } = event;
                    console.log(`   事件: ${section}.${method}`, data.toString());
                    
                    if (section === 'system' && method === 'ExtrinsicFailed') {
                        const [dispatchError] = data;
                        let errorInfo = dispatchError.toString();
                        
                        if (dispatchError.isModule) {
                            const decoded = api.registry.findMetaError(dispatchError.asModule);
                            errorInfo = `${decoded.section}.${decoded.name}: ${decoded.docs}`;
                        }
                        
                        console.error(`\n❌ 交易失败: ${errorInfo}`);
                        reject(new Error(errorInfo));
                    }
                });
            } else if (status.isFinalized) {
                console.log(`🎉 交易已确认: ${status.asFinalized.toHex()}\n`);
                console.log('✅ 路由表配置完成！（2024-10-10 调整版）\n');
                console.log('📊 资金分配汇总（以 100,000 MEMO 供奉为例）:');
                console.log(`   主题账户: 2,000 MEMO (2%) ← 逝者家属可用于墓位维护 [从 10% 降到 2%]`);
                console.log(`   销毁: 3,000 MEMO (3%) ← 通缩机制 [从 5% 降到 3%]`);
                console.log(`   国库: 3,000 MEMO (3%) ← 平台运营 [保持不变]`);
                console.log(`   去中心化存储: 2,000 MEMO (2%) ← IPFS + 自建节点 + 备份 [保持不变]`);
                console.log(`   推荐分配: 90,000 MEMO (90%) ← 强激励推荐网络 [从 80% 升到 90%]`);
                console.log(`   总计: 100,000 MEMO (100%)\n`);
                console.log('⚠️  调整说明:');
                console.log(`   ↑ 推荐激励大幅提升 (+10%) → 快速扩张推荐网络`);
                console.log(`   ↓ 家属资金削减 (-8%) → 优先激励推荐者`);
                console.log(`   ↓ 销毁削减 (-2%) → 更多资金用于推荐\n`);
                resolve();
            }
        }).catch(reject);
    });
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('\n❌ 错误:', error.message);
        process.exit(1);
    });

