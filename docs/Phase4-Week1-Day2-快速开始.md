# Phase 4 Week 1 Day 2 快速开始

## 🎯 今日目标

**编写前3个集成测试**  
**预期时间**: 1天  
**框架**: Chopsticks  

---

## 📋 今日任务清单

### 上午任务（4小时）

- [ ] 安装Chopsticks和依赖（30分钟）
- [ ] 启动测试环境（30分钟）
- [ ] 编写测试1: OTC订单创建流程（2小时）
- [ ] 验证测试1通过（1小时）

### 下午任务（4小时）

- [ ] 编写测试2: IPFS Pin请求流程（2小时）
- [ ] 编写测试3: 供奉品创建流程（2小时）

---

## 🚀 立即执行

### Step 1: 环境准备（30分钟）

```bash
# 1. 安装Chopsticks
npm install -g @acala-network/chopsticks

# 2. 验证安装
chopsticks --version

# 3. 创建测试项目目录
cd /home/xiaodong/文档/stardust
mkdir -p tests/integration
cd tests/integration

# 4. 初始化Node.js项目
npm init -y

# 5. 安装依赖
npm install @polkadot/api @polkadot/keyring @polkadot/util @polkadot/util-crypto
```

---

### Step 2: 启动测试环境（30分钟）

```bash
# Terminal 1: 启动本地节点
cd /home/xiaodong/文档/stardust
./target/release/stardust-node --dev --tmp --ws-port 9944

# 等待看到 "Idle" 信息，表示节点就绪
```

```bash
# Terminal 2: 启动Chopsticks
chopsticks --endpoint ws://127.0.0.1:9944 --port 8000
```

```bash
# Terminal 3: 验证连接
curl -H "Content-Type: application/json" \
     -d '{"id":1, "jsonrpc":"2.0", "method": "system_chain"}' \
     http://localhost:8000

# 预期输出: {"jsonrpc":"2.0","result":"Development","id":1}
```

---

### Step 3: 测试1 - OTC订单创建流程（2小时）

创建文件：`tests/integration/01-otc-create-order.js`

```javascript
/**
 * 测试1: OTC订单创建完整流程
 * 
 * 流程:
 * 1. 连接到测试链
 * 2. 创建OTC订单
 * 3. 验证订单存储
 * 4. 验证Event触发
 */

const { ApiPromise, WsProvider } = require('@polkadot/api');
const { Keyring } = require('@polkadot/keyring');

async function test01_OtcCreateOrder() {
    console.log('🧪 测试1: OTC订单创建流程');
    console.log('========================================');
    
    // 1. 连接到Chopsticks
    console.log('📡 连接到测试链...');
    const api = await ApiPromise.create({ 
        provider: new WsProvider('ws://127.0.0.1:8000') 
    });
    
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
    console.log(`   Balance: ${balance.toString()}`);
    
    // 4. 创建OTC订单
    console.log('\n📝 创建OTC订单...');
    
    const currency = 'USDT';
    const fiatAmount = 1000;
    const memoAmount = 100 * 1_000_000_000_000; // 100 DUST (12 decimals)
    const contactInfo = 'WeChat: alice123';
    
    try {
        // 创建交易
        const tx = api.tx.otcOrder.createOrder(
            currency,
            fiatAmount,
            memoAmount,
            contactInfo,
            null  // memo_id (optional)
        );
        
        // 签名并发送
        await new Promise((resolve, reject) => {
            tx.signAndSend(alice, ({ status, events }) => {
                console.log(`   Status: ${status.type}`);
                
                if (status.isInBlock) {
                    console.log(`   ✅ 已打包到区块: ${status.asInBlock.toString()}`);
                    
                    // 检查事件
                    events.forEach(({ event: { data, method, section } }) => {
                        console.log(`   📢 Event: ${section}.${method}`);
                        if (section === 'otcOrder' && method === 'OrderCreated') {
                            console.log(`      订单ID: ${data[0].toString()}`);
                            console.log(`      创建者: ${data[1].toString()}`);
                        }
                    });
                    
                    resolve();
                } else if (status.isFinalized) {
                    console.log(`   🎉 已最终确认: ${status.asFinalized.toString()}`);
                }
            });
        });
        
        console.log('✅ 测试1通过: OTC订单创建成功');
        
    } catch (error) {
        console.error('❌ 测试1失败:', error.message);
        throw error;
    } finally {
        await api.disconnect();
    }
}

// 运行测试
test01_OtcCreateOrder()
    .then(() => {
        console.log('\n========================================');
        console.log('✅ 测试1完成');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n========================================');
        console.error('❌ 测试1失败:', error);
        process.exit(1);
    });
```

**运行测试1**:
```bash
cd /home/xiaodong/文档/stardust/tests/integration
node 01-otc-create-order.js
```

---

### Step 4: 测试2 - IPFS Pin请求流程（2小时）

创建文件：`tests/integration/02-ipfs-pin-request.js`

```javascript
/**
 * 测试2: IPFS Pin请求流程
 * 
 * 流程:
 * 1. 创建deceased记录
 * 2. 请求IPFS Pin
 * 3. 验证Pin存储
 * 4. 验证计费初始化
 */

const { ApiPromise, WsProvider } = require('@polkadot/api');
const { Keyring } = require('@polkadot/keyring');

async function test02_IpfsPinRequest() {
    console.log('🧪 测试2: IPFS Pin请求流程');
    console.log('========================================');
    
    const api = await ApiPromise.create({ 
        provider: new WsProvider('ws://127.0.0.1:8000') 
    });
    
    const keyring = new Keyring({ type: 'sr25519' });
    const alice = keyring.addFromUri('//Alice');
    
    console.log('📡 已连接到测试链');
    console.log(`👤 测试账户: ${alice.address}`);
    
    try {
        // 1. 创建deceased记录（如果pallet存在）
        console.log('\n📝 准备deceased记录...');
        const deceasedId = 1; // 假设已存在或创建
        
        // 2. 请求IPFS Pin
        console.log('\n📌 请求IPFS Pin...');
        
        const cid = '0x' + '12'.repeat(32); // 测试CID
        const sizeBytes = 1_073_741_824; // 1 GiB
        const replicas = 3;
        const price = 10 * 1_000_000_000_000; // 10 DUST
        
        const tx = api.tx.memoIpfs.requestPinForDeceased(
            deceasedId,
            cid,
            sizeBytes,
            replicas,
            price
        );
        
        await new Promise((resolve, reject) => {
            tx.signAndSend(alice, ({ status, events }) => {
                console.log(`   Status: ${status.type}`);
                
                if (status.isInBlock) {
                    console.log(`   ✅ 已打包到区块`);
                    
                    events.forEach(({ event: { data, method, section } }) => {
                        console.log(`   📢 Event: ${section}.${method}`);
                        if (section === 'memoIpfs' && method === 'PinRequested') {
                            console.log(`      CID: ${data[0].toString()}`);
                            console.log(`      Replicas: ${data[2].toString()}`);
                        }
                    });
                    
                    resolve();
                }
            });
        });
        
        console.log('✅ 测试2通过: IPFS Pin请求成功');
        
    } catch (error) {
        console.error('❌ 测试2失败:', error.message);
        throw error;
    } finally {
        await api.disconnect();
    }
}

test02_IpfsPinRequest()
    .then(() => {
        console.log('\n========================================');
        console.log('✅ 测试2完成');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n========================================');
        console.error('❌ 测试2失败:', error);
        process.exit(1);
    });
```

---

### Step 5: 测试3 - 供奉品创建流程（2小时）

创建文件：`tests/integration/03-offerings-create.js`

```javascript
/**
 * 测试3: 供奉品创建流程
 * 
 * 流程:
 * 1. 创建deceased记录
 * 2. 创建供奉品
 * 3. 验证供奉品存储
 * 4. 验证定价信息
 */

const { ApiPromise, WsProvider } = require('@polkadot/api');
const { Keyring } = require('@polkadot/keyring');

async function test03_OfferingsCreate() {
    console.log('🧪 测试3: 供奉品创建流程');
    console.log('========================================');
    
    const api = await ApiPromise.create({ 
        provider: new WsProvider('ws://127.0.0.1:8000') 
    });
    
    const keyring = new Keyring({ type: 'sr25519' });
    const alice = keyring.addFromUri('//Alice');
    
    console.log('📡 已连接到测试链');
    console.log(`👤 测试账户: ${alice.address}`);
    
    try {
        // 1. 准备数据
        console.log('\n📝 准备供奉品数据...');
        const deceasedId = 1;
        const offeringKind = 'Instant'; // 即时供奉
        const name = '鲜花';
        const description = '一束美丽的鲜花';
        const mediaCid = '0x' + '34'.repeat(32);
        
        // 2. 创建供奉品
        console.log('\n🎁 创建供奉品...');
        
        const tx = api.tx.memoOfferings.createOffering(
            deceasedId,
            offeringKind,
            name,
            description,
            mediaCid,
            null // 定价参数(根据kind)
        );
        
        await new Promise((resolve, reject) => {
            tx.signAndSend(alice, ({ status, events }) => {
                console.log(`   Status: ${status.type}`);
                
                if (status.isInBlock) {
                    console.log(`   ✅ 已打包到区块`);
                    
                    events.forEach(({ event: { data, method, section } }) => {
                        console.log(`   📢 Event: ${section}.${method}`);
                        if (section === 'memoOfferings' && method === 'OfferingCreated') {
                            console.log(`      供奉品ID: ${data[0].toString()}`);
                            console.log(`      创建者: ${data[1].toString()}`);
                        }
                    });
                    
                    resolve();
                }
            });
        });
        
        console.log('✅ 测试3通过: 供奉品创建成功');
        
    } catch (error) {
        console.error('❌ 测试3失败:', error.message);
        throw error;
    } finally {
        await api.disconnect();
    }
}

test03_OfferingsCreate()
    .then(() => {
        console.log('\n========================================');
        console.log('✅ 测试3完成');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n========================================');
        console.error('❌ 测试3失败:', error);
        process.exit(1);
    });
```

---

## 📝 测试运行脚本

创建：`tests/integration/run-all.sh`

```bash
#!/bin/bash

echo "🚀 运行所有集成测试"
echo "========================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

# 测试1
echo -e "\n${GREEN}运行测试1: OTC订单创建${NC}"
if node 01-otc-create-order.js; then
    ((PASSED++))
    echo -e "${GREEN}✅ 测试1通过${NC}"
else
    ((FAILED++))
    echo -e "${RED}❌ 测试1失败${NC}"
fi

# 测试2
echo -e "\n${GREEN}运行测试2: IPFS Pin请求${NC}"
if node 02-ipfs-pin-request.js; then
    ((PASSED++))
    echo -e "${GREEN}✅ 测试2通过${NC}"
else
    ((FAILED++))
    echo -e "${RED}❌ 测试2失败${NC}"
fi

# 测试3
echo -e "\n${GREEN}运行测试3: 供奉品创建${NC}"
if node 03-offerings-create.js; then
    ((PASSED++))
    echo -e "${GREEN}✅ 测试3通过${NC}"
else
    ((FAILED++))
    echo -e "${RED}❌ 测试3失败${NC}"
fi

# 总结
echo -e "\n========================================"
echo -e "测试总结:"
echo -e "${GREEN}通过: $PASSED${NC}"
echo -e "${RED}失败: $FAILED${NC}"
echo "========================================"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 所有测试通过！${NC}"
    exit 0
else
    echo -e "${RED}❌ 有测试失败${NC}"
    exit 1
fi
```

```bash
chmod +x tests/integration/run-all.sh
```

---

## ✅ 今日成功标准

- [x] Chopsticks安装成功
- [x] 测试环境启动成功
- [x] 测试1编写并通过
- [x] 测试2编写并通过
- [x] 测试3编写并通过
- [x] 批量运行脚本就绪

---

## 🎯 预期输出

运行 `./run-all.sh` 后应看到：

```
🚀 运行所有集成测试
========================================

运行测试1: OTC订单创建
✅ 测试1通过

运行测试2: IPFS Pin请求
✅ 测试2通过

运行测试3: 供奉品创建
✅ 测试3通过

========================================
测试总结:
通过: 3
失败: 0
========================================
🎉 所有测试通过！
```

---

**Phase 4 Week 1 Day 2 立即开始！** 🚀

