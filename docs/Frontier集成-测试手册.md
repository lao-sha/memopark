# Frontier 集成测试手册

本文档提供详细的测试步骤和用例，用于验证 Frontier 集成的正确性。

---

## 一、测试环境准备

### 1.1 本地开发环境

```bash
# 1. 启动开发节点
./target/release/stardust-node \
  --dev \
  --tmp \
  --rpc-port 9944 \
  --rpc-cors all \
  --rpc-methods=unsafe

# 2. 验证节点运行
curl http://localhost:9944/health
```

### 1.2 安装测试工具

```bash
# 安装 Node.js 依赖
cd stardust-dapp
npm install ethers hardhat @nomiclabs/hardhat-ethers

# 全局安装测试工具
npm install -g @polkadot/api-cli
```

---

## 二、Substrate RPC 测试

### 2.1 系统信息查询

```bash
# 查询节点名称
curl -X POST http://localhost:9944 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"system_name",
    "params":[],
    "id":1
  }'

# 预期返回: {"jsonrpc":"2.0","result":"stardust-node","id":1}
```

### 2.2 EVM Pallet 状态查询

```bash
# 查询 EVM 账户 nonce
curl -X POST http://localhost:9944 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"state_getStorage",
    "params":["0x..."],
    "id":1
  }'
```

### 2.3 测试账户创建

使用 Polkadot.js Apps:

1. 打开 https://polkadot.js.org/apps/
2. 连接到 `ws://localhost:9944`
3. Developer > Chain State
4. 选择 `evm` pallet
5. 查看 `accountCodes`, `accountStorages` 存储

---

## 三、Ethereum RPC 测试（Phase 2 后）

### 3.1 基础 RPC 测试

```bash
# 测试 1: 查询 Chain ID
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"eth_chainId",
    "params":[],
    "id":1
  }'

# 预期: {"jsonrpc":"2.0","result":"0x22b8","id":1}  (8888 in hex)


# 测试 2: 查询最新区块号
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"eth_blockNumber",
    "params":[],
    "id":1
  }'

# 预期: {"jsonrpc":"2.0","result":"0x1234","id":1}


# 测试 3: 查询账户余额
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"eth_getBalance",
    "params":["0x6Be02d1d3665660d22FF9624b7BE0551ee1Ac91b", "latest"],
    "id":1
  }'

# 预期: {"jsonrpc":"2.0","result":"0x0","id":1}
```

### 3.2 Gas 估算测试

```bash
# 估算简单转账 Gas
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"eth_estimateGas",
    "params":[{
      "from": "0x6Be02d1d3665660d22FF9624b7BE0551ee1Ac91b",
      "to": "0x7F0d15C7FAae65896648C8273B6d7E43f58Fa842",
      "value": "0xDE0B6B3A7640000"
    }],
    "id":1
  }'

# 预期: {"jsonrpc":"2.0","result":"0x5208","id":1}  (21000 gas)
```

### 3.3 交易发送测试

```javascript
// test-eth-transaction.js

const { ethers } = require('ethers');

async function testTransaction() {
  // 连接到本地节点
  const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
  
  // 创建测试钱包（使用开发助记词）
  const wallet = ethers.Wallet.fromMnemonic(
    'bottom drive obey lake curtain smoke basket hold race lonely fit walk'
  ).connect(provider);
  
  console.log('钱包地址:', wallet.address);
  
  // 查询余额
  const balance = await provider.getBalance(wallet.address);
  console.log('余额:', ethers.utils.formatEther(balance), 'DUST');
  
  // 发送测试交易
  const tx = await wallet.sendTransaction({
    to: '0x7F0d15C7FAae65896648C8273B6d7E43f58Fa842',
    value: ethers.utils.parseEther('1.0'),
  });
  
  console.log('交易哈希:', tx.hash);
  
  // 等待确认
  const receipt = await tx.wait();
  console.log('交易确认，区块号:', receipt.blockNumber);
}

testTransaction().catch(console.error);
```

运行测试：

```bash
node test-eth-transaction.js
```

---

## 四、智能合约测试

### 4.1 SimpleStorage 合约

#### **Solidity 代码**

```solidity
// contracts/SimpleStorage.sol

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SimpleStorage {
    uint256 private value;
    
    event ValueChanged(uint256 indexed oldValue, uint256 indexed newValue);
    
    function set(uint256 _value) public {
        uint256 oldValue = value;
        value = _value;
        emit ValueChanged(oldValue, _value);
    }
    
    function get() public view returns (uint256) {
        return value;
    }
}
```

#### **部署脚本**

```javascript
// scripts/deploy-simple-storage.js

const hre = require('hardhat');

async function main() {
  console.log('开始部署 SimpleStorage...');
  
  // 获取合约工厂
  const SimpleStorage = await hre.ethers.getContractFactory('SimpleStorage');
  
  // 部署合约
  const contract = await SimpleStorage.deploy();
  await contract.deployed();
  
  console.log('✓ SimpleStorage 部署成功:', contract.address);
  
  // 测试写入
  console.log('\n测试 set() 函数...');
  const setTx = await contract.set(42);
  await setTx.wait();
  console.log('✓ 交易确认:', setTx.hash);
  
  // 测试读取
  console.log('\n测试 get() 函数...');
  const value = await contract.get();
  console.log('✓ 读取值:', value.toString());
  
  if (value.toNumber() === 42) {
    console.log('\n🎉 所有测试通过！');
  } else {
    console.error('\n❌ 测试失败：值不匹配');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

#### **Hardhat 配置**

```javascript
// hardhat.config.js

require("@nomiclabs/hardhat-ethers");

module.exports = {
  solidity: "0.8.19",
  networks: {
    stardust: {
      url: "http://localhost:8545",
      chainId: 8888,
      accounts: {
        mnemonic: "bottom drive obey lake curtain smoke basket hold race lonely fit walk"
      }
    }
  }
};
```

#### **运行测试**

```bash
# 编译合约
npx hardhat compile

# 部署到本地节点
npx hardhat run scripts/deploy-simple-storage.js --network stardust
```

---

### 4.2 ERC20 代币合约测试

#### **合约代码**

```solidity
// contracts/TestToken.sol

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract TestToken {
    string public name = "Test Token";
    string public symbol = "TEST";
    uint8 public decimals = 18;
    uint256 public totalSupply;
    
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    
    constructor(uint256 _initialSupply) {
        totalSupply = _initialSupply * 10 ** uint256(decimals);
        balanceOf[msg.sender] = totalSupply;
        emit Transfer(address(0), msg.sender, totalSupply);
    }
    
    function transfer(address _to, uint256 _value) public returns (bool) {
        require(balanceOf[msg.sender] >= _value, "Insufficient balance");
        balanceOf[msg.sender] -= _value;
        balanceOf[_to] += _value;
        emit Transfer(msg.sender, _to, _value);
        return true;
    }
    
    function approve(address _spender, uint256 _value) public returns (bool) {
        allowance[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);
        return true;
    }
    
    function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
        require(balanceOf[_from] >= _value, "Insufficient balance");
        require(allowance[_from][msg.sender] >= _value, "Allowance exceeded");
        
        balanceOf[_from] -= _value;
        balanceOf[_to] += _value;
        allowance[_from][msg.sender] -= _value;
        
        emit Transfer(_from, _to, _value);
        return true;
    }
}
```

#### **测试脚本**

```javascript
// test/TestToken.test.js

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TestToken", function () {
  let token;
  let owner;
  let addr1;
  let addr2;
  
  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    
    const TestToken = await ethers.getContractFactory("TestToken");
    token = await TestToken.deploy(1000000); // 1M tokens
    await token.deployed();
  });
  
  describe("部署测试", function () {
    it("应该正确设置代币信息", async function () {
      expect(await token.name()).to.equal("Test Token");
      expect(await token.symbol()).to.equal("TEST");
      expect(await token.decimals()).to.equal(18);
    });
    
    it("应该将总供应量分配给所有者", async function () {
      const ownerBalance = await token.balanceOf(owner.address);
      expect(await token.totalSupply()).to.equal(ownerBalance);
    });
  });
  
  describe("交易测试", function () {
    it("应该能够转账代币", async function () {
      await token.transfer(addr1.address, 50);
      const addr1Balance = await token.balanceOf(addr1.address);
      expect(addr1Balance).to.equal(50);
    });
    
    it("应该在余额不足时失败", async function () {
      const initialOwnerBalance = await token.balanceOf(owner.address);
      
      await expect(
        token.connect(addr1).transfer(owner.address, 1)
      ).to.be.revertedWith("Insufficient balance");
      
      expect(await token.balanceOf(owner.address)).to.equal(initialOwnerBalance);
    });
  });
  
  describe("授权测试", function () {
    it("应该能够授权并转账", async function () {
      await token.approve(addr1.address, 100);
      await token.connect(addr1).transferFrom(owner.address, addr2.address, 50);
      
      expect(await token.balanceOf(addr2.address)).to.equal(50);
    });
  });
});
```

运行测试：

```bash
npx hardhat test --network stardust
```

---

## 五、预编译合约测试（Phase 2）

### 5.1 DUST 余额查询预编译

#### **测试脚本**

```javascript
// test-dust-balance-precompile.js

const { ethers } = require('ethers');

const DUST_BALANCE_ADDRESS = '0x0000000000000000000000000000000000000400';
const DUST_BALANCE_ABI = [
  "function balanceOf(address account) external view returns (uint256)"
];

async function testDustBalance() {
  const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
  const contract = new ethers.Contract(DUST_BALANCE_ADDRESS, DUST_BALANCE_ABI, provider);
  
  // 测试地址（Alice 的以太坊映射地址）
  const testAddress = '0xd43593c715fdd31c61141abd04a99fd6822c8558';
  
  console.log('查询地址:', testAddress);
  
  try {
    const balance = await contract.balanceOf(testAddress);
    console.log('DUST 余额:', ethers.utils.formatUnits(balance, 12));
    console.log('✓ 预编译合约调用成功');
  } catch (error) {
    console.error('❌ 调用失败:', error.message);
  }
}

testDustBalance();
```

### 5.2 Memorial 预编译测试

```javascript
// test-memorial-precompile.js

const MEMORIAL_ADDRESS = '0x0000000000000000000000000000000000000401';
const MEMORIAL_ABI = [
  "function createMemorial(string memory name, string memory ipfsCid) external returns (uint64)",
  "function getMemorial(uint64 memorialId) external view returns (string memory, string memory)"
];

async function testMemorial() {
  const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
  const wallet = ethers.Wallet.fromMnemonic(
    'bottom drive obey lake curtain smoke basket hold race lonely fit walk'
  ).connect(provider);
  
  const memorial = new ethers.Contract(MEMORIAL_ADDRESS, MEMORIAL_ABI, wallet);
  
  // 创建纪念馆
  console.log('创建纪念馆...');
  const tx = await memorial.createMemorial(
    "测试纪念馆",
    "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"
  );
  const receipt = await tx.wait();
  
  console.log('✓ 纪念馆创建成功');
  console.log('交易哈希:', receipt.transactionHash);
  
  // 查询纪念馆
  // const [name, ipfsCid] = await memorial.getMemorial(1);
  // console.log('名称:', name);
  // console.log('IPFS CID:', ipfsCid);
}

testMemorial().catch(console.error);
```

---

## 六、性能测试

### 6.1 TPS 测试

```javascript
// test-tps.js

const { ethers } = require('ethers');

async function testTPS() {
  const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
  const wallet = ethers.Wallet.fromMnemonic(
    'bottom drive obey lake curtain smoke basket hold race lonely fit walk'
  ).connect(provider);
  
  const testAddress = '0x7F0d15C7FAae65896648C8273B6d7E43f58Fa842';
  const numTransactions = 100;
  
  console.log(`发送 ${numTransactions} 笔交易...`);
  const startTime = Date.now();
  
  const txPromises = [];
  for (let i = 0; i < numTransactions; i++) {
    txPromises.push(
      wallet.sendTransaction({
        to: testAddress,
        value: ethers.utils.parseEther('0.01'),
      })
    );
  }
  
  await Promise.all(txPromises);
  const endTime = Date.now();
  
  const duration = (endTime - startTime) / 1000;
  const tps = numTransactions / duration;
  
  console.log(`✓ 完成 ${numTransactions} 笔交易`);
  console.log(`耗时: ${duration.toFixed(2)} 秒`);
  console.log(`TPS: ${tps.toFixed(2)}`);
}

testTPS().catch(console.error);
```

### 6.2 Gas 消耗测试

```javascript
// test-gas-consumption.js

async function testGasConsumption() {
  const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
  
  // 部署合约的 Gas 消耗
  const SimpleStorage = await ethers.getContractFactory('SimpleStorage');
  const deployTx = SimpleStorage.getDeployTransaction();
  const estimatedGas = await provider.estimateGas(deployTx);
  
  console.log('SimpleStorage 部署 Gas:', estimatedGas.toString());
  
  // 简单转账的 Gas 消耗
  const transferGas = await provider.estimateGas({
    to: '0x7F0d15C7FAae65896648C8273B6d7E43f58Fa842',
    value: ethers.utils.parseEther('1.0'),
  });
  
  console.log('简单转账 Gas:', transferGas.toString());
}

testGasConsumption().catch(console.error);
```

---

## 七、MetaMask 集成测试

### 7.1 添加网络

1. 打开 MetaMask
2. 点击网络下拉菜单
3. 选择"添加网络"
4. 手动添加网络：
   - **网络名称**: Stardust Local
   - **RPC URL**: http://localhost:8545
   - **Chain ID**: 8888
   - **货币符号**: DUST
   - **区块浏览器**: (留空)

### 7.2 导入测试账户

```
助记词: bottom drive obey lake curtain smoke basket hold race lonely fit walk
```

### 7.3 测试操作

- [ ] 查看余额
- [ ] 发送交易
- [ ] 部署合约（使用 Remix）
- [ ] 调用合约函数
- [ ] 查看交易历史

---

## 八、集成测试清单

### Phase 1: 基础功能（当前）

- [ ] Substrate RPC 正常工作
- [ ] EVM Pallet 存储可查询
- [ ] Runtime 编译无错误
- [ ] Node 启动无错误

### Phase 2: EVM RPC（下一阶段）

- [ ] `eth_chainId` 返回正确
- [ ] `eth_blockNumber` 正常
- [ ] `eth_getBalance` 可查询
- [ ] `eth_estimateGas` 准确
- [ ] `eth_sendRawTransaction` 成功
- [ ] `eth_getTransactionReceipt` 正确

### Phase 3: 智能合约

- [ ] SimpleStorage 部署成功
- [ ] SimpleStorage 读写正常
- [ ] ERC20 合约正常运行
- [ ] 事件日志可查询
- [ ] Gas 消耗合理

### Phase 4: 预编译合约

- [ ] DUST 余额查询正确
- [ ] Memorial 创建成功
- [ ] Maker 操作正常
- [ ] Bridge 桥接正常

### Phase 5: 前端集成

- [ ] MetaMask 连接成功
- [ ] WalletConnect 正常
- [ ] 交易流程顺畅
- [ ] UI/UX 良好

---

## 九、问题排查指南

### 问题 1: "insufficient funds for gas"

**原因**: 账户余额不足

**解决**:

```bash
# 通过 Substrate 转账到 EVM 账户
# 使用 Polkadot.js Apps 转账到映射地址
```

### 问题 2: "nonce too low"

**原因**: Nonce 不同步

**解决**:

```javascript
// 重置 nonce
const nonce = await provider.getTransactionCount(wallet.address, 'pending');
```

### 问题 3: "execution reverted"

**原因**: 合约执行失败

**解决**:

```javascript
// 启用详细错误
const tx = await contract.set(42, { gasLimit: 1000000 });
```

---

## 十、测试报告模板

```markdown
## Frontier 集成测试报告

**测试日期**: 2025-11-XX  
**测试人员**: [姓名]  
**环境**: 本地开发环境

### 测试结果

| 测试项 | 状态 | 备注 |
|--------|------|------|
| Substrate RPC | ✅ | 正常 |
| EVM Pallet | ✅ | 正常 |
| Ethereum RPC | ⏸️ | Phase 2 |
| SimpleStorage | ⏸️ | Phase 2 |
| 预编译合约 | ⏸️ | Phase 2 |

### 发现的问题

1. [问题描述]
2. [问题描述]

### 建议

1. [建议内容]
2. [建议内容]
```

---

**需要帮助？**

- 参考完整方案: `docs/Frontier集成方案.md`
- 快速开始: `docs/Frontier集成-快速开始.md`
- 运行检查: `bash scripts/frontier-integration-checklist.sh`

