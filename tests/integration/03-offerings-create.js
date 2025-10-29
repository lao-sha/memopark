/**
 * 集成测试3: 供奉品创建流程
 * 
 * 测试范围:
 * 1. 创建deceased记录
 * 2. 创建供奉品
 * 3. 验证供奉品存储
 * 4. 验证定价信息
 * 
 * @requires memopark-node运行在 ws://127.0.0.1:9944
 */

const { ApiPromise, WsProvider } = require('@polkadot/api');
const { Keyring } = require('@polkadot/keyring');

async function test03_OfferingsCreate() {
    console.log('🧪 集成测试3: 供奉品创建流程');
    console.log('========================================');
    
    let api;
    
    try {
        // 1. 连接到测试链
        console.log('📡 连接到测试链...');
        const provider = new WsProvider('ws://127.0.0.1:9944');
        api = await ApiPromise.create({ provider });
        
        console.log('✅ 已连接');
        const keyring = new Keyring({ type: 'sr25519' });
        const alice = keyring.addFromUri('//Alice');
        
        console.log(`👤 测试账户: ${alice.address}`);
        
        // 2. 准备deceased（假设存在）
        const deceasedId = 1;
        console.log(`\n📝 使用Deceased ID: ${deceasedId}`);
        
        // 3. 准备供奉品数据
        console.log('\n🎁 准备供奉品数据...');
        
        const offeringKind = 'Instant'; // 即时供奉
        const name = '鲜花_' + Date.now();
        const description = '一束美丽的鲜花，表达永恒的思念';
        
        // 生成测试CID
        const cidBytes = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
            cidBytes[i] = (i + 50) % 256;
        }
        const mediaCid = '0x' + Array.from(cidBytes).map(b => b.toString(16).padStart(2, '0')).join('');
        
        console.log(`   Kind: ${offeringKind}`);
        console.log(`   Name: ${name}`);
        console.log(`   Description: ${description}`);
        console.log(`   Media CID: ${mediaCid.substring(0, 10)}...`);
        
        // 4. 创建供奉品
        console.log('\n📤 发送交易: createOffering...');
        
        const tx = api.tx.memoOfferings.createOffering(
            deceasedId,
            offeringKind,
            name,
            description,
            mediaCid,
            null // 定价参数(根据kind决定)
        );
        
        let offeringId = null;
        await new Promise((resolve, reject) => {
            tx.signAndSend(alice, ({ status, dispatchError, events }) => {
                console.log(`   Status: ${status.type}`);
                
                if (dispatchError) {
                    let errorInfo = '';
                    if (dispatchError.isModule) {
                        const decoded = api.registry.findMetaError(dispatchError.asModule);
                        errorInfo = `${decoded.section}.${decoded.name}: ${decoded.docs}`;
                    } else {
                        errorInfo = dispatchError.toString();
                    }
                    console.error(`   ❌ 交易失败: ${errorInfo}`);
                    reject(new Error(errorInfo));
                    return;
                }
                
                if (status.isInBlock) {
                    console.log(`   ✅ 已打包到区块`);
                    
                    console.log('\n📢 事件列表:');
                    events.forEach(({ event: { data, method, section } }) => {
                        console.log(`   - ${section}.${method}`);
                        
                        if (section === 'memoOfferings' && method === 'OfferingCreated') {
                            offeringId = data[0].toString();
                            console.log(`     供奉品ID: ${offeringId}`);
                            console.log(`     创建者: ${data[1].toString()}`);
                            console.log(`     Deceased: ${data[2].toString()}`);
                        }
                    });
                    
                    resolve();
                }
            });
        });
        
        // 5. 验证供奉品存储
        if (offeringId) {
            console.log('\n🔍 验证供奉品存储...');
            const offeringOption = await api.query.memoOfferings.offerings(offeringId);
            
            if (offeringOption.isSome) {
                const offering = offeringOption.unwrap();
                console.log('   ✅ 供奉品已存储:');
                console.log(`      Creator: ${offering.creator.toString()}`);
                console.log(`      Deceased: ${offering.deceasedId.toString()}`);
                console.log(`      Kind: ${offering.kind.toString()}`);
                console.log(`      Name: ${offering.name.toString()}`);
                console.log(`      Status: ${offering.status ? offering.status.toString() : 'N/A'}`);
            } else {
                throw new Error('供奉品未找到！');
            }
            
            // 6. 查询定价信息
            console.log('\n💰 查询定价信息...');
            const priceOption = await api.query.memoOfferings.offeringPrices(offeringId);
            
            if (priceOption && priceOption.isSome) {
                const price = priceOption.unwrap();
                console.log('   ✅ 定价已设置:');
                console.log(`      Base Price: ${price.toString()}`);
            } else {
                console.log('   ⚠️  未设置定价（可能是即时供奉）');
            }
        }
        
        console.log('\n========================================');
        console.log('✅ 测试3通过: 供奉品创建成功');
        
    } catch (error) {
        console.error('\n========================================');
        console.error('❌ 测试3失败:', error.message);
        throw error;
    } finally {
        if (api) {
            await api.disconnect();
            console.log('📡 已断开连接');
        }
    }
}

// 运行测试
if (require.main === module) {
    test03_OfferingsCreate()
        .then(() => {
            console.log('\n🎉 测试完成');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 测试失败:', error);
            process.exit(1);
        });
}

module.exports = test03_OfferingsCreate;

