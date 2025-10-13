#!/usr/bin/env node

/**
 * 计算存储费用路由池账户地址
 * 
 * 用途：
 * - 从 PalletId 派生确定性账户地址
 * - 用于存储费用自动路由分配
 * - 无私钥控制，通过 pallet 逻辑管理
 */

const { encodeAddress } = require('@polkadot/util-crypto');
const { blake2AsU8a, blake2AsHex } = require('@polkadot/util-crypto');

// PalletId 定义（8 字节）
const PALLET_IDS = {
    ipfs: Buffer.from('py/ipfs+', 'utf-8'),      // IPFS 运营者池
    arweave: Buffer.from('py/arwve', 'utf-8'),   // Arweave 运营者池
    nodes: Buffer.from('py/nodes', 'utf-8'),     // 节点运维激励池
};

/**
 * 从 PalletId 派生账户地址
 * 
 * 算法：
 * 1. 构造输入：prefix "modl" + PalletId (8字节)
 * 2. Blake2_256 哈希
 * 3. SS58 编码（Format 42 = Substrate generic）
 */
function deriveAccountFromPalletId(palletId, name) {
    // 1. 构造输入
    const prefix = Buffer.from('modl', 'utf-8');
    const input = Buffer.concat([prefix, palletId]);
    
    // 填充到 32 字节（如果需要）
    const paddedInput = Buffer.alloc(32);
    input.copy(paddedInput);
    
    // 2. Blake2_256 哈希
    const accountId = blake2AsU8a(paddedInput, 256);
    
    // 3. SS58 编码（Format 42）
    const ss58Address = encodeAddress(accountId, 42);
    
    // 十六进制表示
    const hexAddress = '0x' + Buffer.from(accountId).toString('hex');
    
    return {
        name,
        palletId: palletId.toString('utf-8'),
        palletIdHex: '0x' + palletId.toString('hex'),
        accountIdHex: hexAddress,
        ss58Address,
    };
}

console.log('========================================');
console.log('存储费用路由池账户地址');
console.log('========================================\n');

// 计算三个池账户地址
const ipfsPool = deriveAccountFromPalletId(PALLET_IDS.ipfs, 'IPFS 运营者池');
const arweavePool = deriveAccountFromPalletId(PALLET_IDS.arweave, 'Arweave 运营者池');
const nodesPool = deriveAccountFromPalletId(PALLET_IDS.nodes, '节点运维激励池');

// 输出结果
console.log('1️⃣  IPFS 运营者池（50% 分配）');
console.log(`   PalletId:      ${ipfsPool.palletId}`);
console.log(`   PalletId (hex): ${ipfsPool.palletIdHex}`);
console.log(`   AccountId:      ${ipfsPool.accountIdHex}`);
console.log(`   SS58 Address:   ${ipfsPool.ss58Address}`);
console.log('');

console.log('2️⃣  Arweave 运营者池（30% 分配）');
console.log(`   PalletId:      ${arweavePool.palletId}`);
console.log(`   PalletId (hex): ${arweavePool.palletIdHex}`);
console.log(`   AccountId:      ${arweavePool.accountIdHex}`);
console.log(`   SS58 Address:   ${arweavePool.ss58Address}`);
console.log('');

console.log('3️⃣  节点运维激励池（20% 分配）');
console.log(`   PalletId:      ${nodesPool.palletId}`);
console.log(`   PalletId (hex): ${nodesPool.palletIdHex}`);
console.log(`   AccountId:      ${nodesPool.accountIdHex}`);
console.log(`   SS58 Address:   ${nodesPool.ss58Address}`);
console.log('');

console.log('========================================');
console.log('验证信息');
console.log('========================================\n');

console.log('✅ 派生算法: Blake2_256("modl" + PalletId)');
console.log('✅ SS58 Format: 42 (Substrate generic)');
console.log('✅ 账户类型: PalletId 派生（无私钥）');
console.log('✅ 资金管理: 通过 pallet 逻辑或治理');
console.log('');

console.log('========================================');
console.log('使用说明');
console.log('========================================\n');

console.log('1. 查询账户余额:');
console.log('   ```bash');
console.log(`   curl -X POST http://localhost:9944 -H "Content-Type: application/json" -d '{`);
console.log(`     "jsonrpc": "2.0",`);
console.log(`     "method": "system_account",`);
console.log(`     "params": ["${ipfsPool.ss58Address}"],`);
console.log(`     "id": 1`);
console.log(`   }'`);
console.log('   ```');
console.log('');

console.log('2. 从托管账户提取资金（需要 pallet 逻辑或治理提案）:');
console.log('   - 创建专用的提取函数');
console.log('   - 或通过治理提案调用 force_transfer');
console.log('');

console.log('3. 监控自动分配:');
console.log('   - 监听 StorageTreasury.RouteDistributed 事件');
console.log('   - 查询 DistributionHistory 存储');
console.log('');

console.log('========================================');
console.log('路由表配置示例');
console.log('========================================\n');

console.log('```rust');
console.log('let routes = alloc::vec![');
console.log(`    (0u8, "${ipfsPool.ss58Address}",    Permill::from_percent(50)),`);
console.log(`    (1u8, "${arweavePool.ss58Address}", Permill::from_percent(30)),`);
console.log(`    (3u8, "${nodesPool.ss58Address}",   Permill::from_percent(20)),`);
console.log('];');
console.log('```');
console.log('');

console.log('========================================\n');

