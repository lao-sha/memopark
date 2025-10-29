/**
 * 集成测试1: OTC订单创建完整流程
 * 
 * 测试范围:
 * 1. 连接到测试链
 * 2. 创建OTC订单
 * 3. 验证订单存储
 * 4. 验证Event触发
 * 
 * @requires memopark-node运行在 ws://127.0.0.1:9944
 */

const { ApiPromise, WsProvider } = require('@polkadot/api');
const { Keyring } = require('@polkadot/keyring');

async function test01_OtcCreateOrder() {
    console.log('🧪 集成测试1: OTC订单创建流程');
    console.log('========================================');
    
    let api;
    
    try {
        // 1. 连接到测试链
        console.log('📡 连接到测试链...');
        const provider = new WsProvider('ws://127.0.0.1:9944');
        api = await ApiPromise.create({ provider });
        
        console.log('✅ 连接成功');
        console.log(`   Chain: ${await api.rpc.system.chain()}`);
        console.log(`   Version: ${await api.rpc.system.version()}`);
        
        // 2. 准备测试账户
        const keyring = new Keyring({ type: 'sr25519' });
        const alice = keyring.addFromUri('//Alice');
        
        console.log('\n👤 测试账户: Alice');
        console.log(`   Address: ${alice.address}`);
        
        // 3. 查询Alice余额
        const { data: { free: balance } } = await api.query.system.account(alice.address);
        console.log(`   Balance: ${balance.toHuman()}`);
        
        // 4. 准备订单数据
        console.log('\n📝 准备订单数据...');
        
        const currency = 'USDT';
        const fiatAmount = 1000;
        const memoAmount = 100_000_000_000_000; // 100 MEMO (12 decimals)
        const contactInfo = 'WeChat: alice_test_' + Date.now();
        
        console.log(`   Currency: ${currency}`);
        console.log(`   Fiat Amount: ${fiatAmount}`);
        console.log(`   MEMO Amount: ${memoAmount / 1_000_000_000_000} MEMO`);
        console.log(`   Contact: ${contactInfo}`);
        
        // 5. 创建OTC订单
        console.log('\n📤 发送交易: createOrder...');
        
        const tx = api.tx.otcOrder.createOrder(
            currency,
            fiatAmount,
            memoAmount,
            contactInfo,
            null  // memo_id (optional)
        );
        
        // 签名并发送
        let orderId = null;
        await new Promise((resolve, reject) => {
            const unsubscribe = tx.signAndSend(alice, ({ status, dispatchError, events }) => {
                console.log(`   Status: ${status.type}`);
                
                // 检查错误
                if (dispatchError) {
                    let errorInfo = '';
                    if (dispatchError.isModule) {
                        const decoded = api.registry.findMetaError(dispatchError.asModule);
                        errorInfo = `${decoded.section}.${decoded.name}: ${decoded.docs}`;
                    } else {
                        errorInfo = dispatchError.toString();
                    }
                    console.error(`   ❌ 交易失败: ${errorInfo}`);
                    unsubscribe();
                    reject(new Error(errorInfo));
                    return;
                }
                
                if (status.isInBlock) {
                    console.log(`   ✅ 已打包到区块: ${status.asInBlock.toString()}`);
                    
                    // 检查事件
                    console.log('\n📢 事件列表:');
                    events.forEach(({ event: { data, method, section } }) => {
                        console.log(`   - ${section}.${method}`);
                        
                        if (section === 'otcOrder' && method === 'OrderCreated') {
                            orderId = data[0].toString();
                            console.log(`     订单ID: ${orderId}`);
                            console.log(`     创建者: ${data[1].toString()}`);
                            console.log(`     货币: ${data[2].toString()}`);
                        }
                    });
                    
                    unsubscribe();
                    resolve();
                }
            });
        });
        
        // 6. 验证订单存储
        if (orderId) {
            console.log('\n🔍 验证订单存储...');
            const orderOption = await api.query.otcOrder.orders(orderId);
            
            if (orderOption.isSome) {
                const order = orderOption.unwrap();
                console.log('   ✅ 订单已存储:');
                console.log(`      Seller: ${order.seller.toString()}`);
                console.log(`      Currency: ${order.currency.toString()}`);
                console.log(`      Fiat: ${order.fiatAmount.toString()}`);
                console.log(`      MEMO: ${order.memoAmount.toString()}`);
                console.log(`      Status: ${order.status.toString()}`);
            } else {
                throw new Error('订单未找到！');
            }
        }
        
        console.log('\n========================================');
        console.log('✅ 测试1通过: OTC订单创建成功');
        
    } catch (error) {
        console.error('\n========================================');
        console.error('❌ 测试1失败:', error.message);
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
    test01_OtcCreateOrder()
        .then(() => {
            console.log('\n🎉 测试完成');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 测试失败:', error);
            process.exit(1);
        });
}

module.exports = test01_OtcCreateOrder;

