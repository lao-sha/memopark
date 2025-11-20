import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Stardust AI 交易系统 - 部署脚本
 * 
 * 部署顺序：
 * 1. DUSTToken (ERC20)
 * 2. DUSTBridge (桥接)
 * 3. StardustTradingVault (交易金库)
 * 4. StardustVaultRouter (DUST 路由)
 */

async function main() {
  console.log("🚀 开始部署 Stardust AI 交易系统...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📍 部署账户:", deployer.address);
  console.log("💰 账户余额:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // ===== 1. 部署 DUSTToken =====
  console.log("1️⃣  部署 DUSTToken...");
  const DUSTToken = await ethers.getContractFactory("DUSTToken");
  const dustToken = await DUSTToken.deploy();
  await dustToken.waitForDeployment();
  const dustAddress = await dustToken.getAddress();
  console.log("✅ DUSTToken 已部署:", dustAddress);
  console.log(`   - 名称: ${await dustToken.name()}`);
  console.log(`   - 符号: ${await dustToken.symbol()}`);
  console.log(`   - 精度: ${await dustToken.decimals()}\n`);

  // ===== 2. 部署 DUSTBridge =====
  console.log("2️⃣  部署 DUSTBridge...");
  const DUSTBridge = await ethers.getContractFactory("DUSTBridge");
  const dustBridge = await DUSTBridge.deploy(dustAddress);
  await dustBridge.waitForDeployment();
  const bridgeAddress = await dustBridge.getAddress();
  console.log("✅ DUSTBridge 已部署:", bridgeAddress);
  
  // 授予 Bridge 铸造权限
  console.log("   - 授予 BRIDGE_ROLE...");
  const BRIDGE_ROLE = await dustToken.BRIDGE_ROLE();
  await dustToken.grantRole(BRIDGE_ROLE, bridgeAddress);
  console.log("   ✅ BRIDGE_ROLE 已授予\n");

  // ===== 3. 部署 StardustTradingVault =====
  console.log("3️⃣  部署 StardustTradingVault...");
  
  // 获取 USDC 地址（根据网络选择）
  const network = await ethers.provider.getNetwork();
  let usdcAddress: string;
  
  if (network.chainId === BigInt(42161)) {
    // Arbitrum 主网
    usdcAddress = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"; // USDC
  } else if (network.chainId === BigInt(421614)) {
    // Arbitrum Sepolia 测试网
    usdcAddress = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d"; // USDC (测试)
  } else {
    // 本地网络（需要先部署 Mock USDC）
    console.log("   ⚠️  本地网络，部署 Mock USDC...");
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const mockUsdc = await MockERC20.deploy("USD Coin", "USDC", 6);
    await mockUsdc.waitForDeployment();
    usdcAddress = await mockUsdc.getAddress();
    console.log("   ✅ Mock USDC 已部署:", usdcAddress);
  }
  
  const StardustTradingVault = await ethers.getContractFactory("StardustTradingVault");
  const vault = await StardustTradingVault.deploy(
    usdcAddress,
    "Stardust USDC Vault",
    "stUSDC"
  );
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("✅ StardustTradingVault 已部署:", vaultAddress);
  console.log(`   - 名称: ${await vault.name()}`);
  console.log(`   - 符号: ${await vault.symbol()}\n`);

  // ===== 4. 部署 StardustVaultRouter =====
  console.log("4️⃣  部署 StardustVaultRouter...");
  
  // 获取 Uniswap V3 Router 地址
  let uniswapRouterAddress: string;
  if (network.chainId === BigInt(42161)) {
    // Arbitrum 主网
    uniswapRouterAddress = "0xE592427A0AEce92De3Edee1F18E0157C05861564"; // SwapRouter
  } else if (network.chainId === BigInt(421614)) {
    // Arbitrum Sepolia 测试网
    uniswapRouterAddress = "0x101F443B4d1b059569D643917553c771E1b9663E"; // SwapRouter (测试)
  } else {
    // 本地网络（需要部署 Mock Router）
    console.log("   ⚠️  本地网络，使用 Mock Uniswap Router");
    uniswapRouterAddress = deployer.address; // 临时使用部署者地址
  }
  
  const StardustVaultRouter = await ethers.getContractFactory("StardustVaultRouter");
  const router = await StardustVaultRouter.deploy(
    dustAddress,
    usdcAddress,
    vaultAddress,
    uniswapRouterAddress
  );
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log("✅ StardustVaultRouter 已部署:", routerAddress);
  
  // 授予 Router ROUTER_ROLE
  console.log("   - 授予 ROUTER_ROLE...");
  const ROUTER_ROLE = await vault.ROUTER_ROLE();
  await vault.grantRole(ROUTER_ROLE, routerAddress);
  console.log("   ✅ ROUTER_ROLE 已授予\n");

  // ===== 5. 配置初始参数 =====
  console.log("5️⃣  配置初始参数...");
  
  // 设置桥接限制
  await dustBridge.setLimits(
    ethers.parseEther("1"),           // 最小 1 DUST
    ethers.parseEther("1000000")      // 最大 1,000,000 DUST
  );
  console.log("   ✅ 桥接限制已设置");
  
  // 设置金库参数
  await vault.setParameters(
    ethers.parseUnits("10", 6),  // 最小存款 10 USDC
    1000,                         // 性能费 10%
    200                           // 管理费 2%
  );
  console.log("   ✅ 金库参数已设置");
  
  // 设置路由参数
  await router.setParameters(
    300,                          // 最大滑点 3%
    ethers.parseEther("10")      // 最小交换 10 DUST
  );
  console.log("   ✅ 路由参数已设置\n");

  // ===== 6. 保存部署信息 =====
  console.log("6️⃣  保存部署信息...");
  
  const deploymentInfo = {
    network: network.name,
    chainId: Number(network.chainId),
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      DUSTToken: {
        address: dustAddress,
        name: await dustToken.name(),
        symbol: await dustToken.symbol(),
      },
      DUSTBridge: {
        address: bridgeAddress,
        dustToken: dustAddress,
      },
      StardustTradingVault: {
        address: vaultAddress,
        name: await vault.name(),
        symbol: await vault.symbol(),
        usdc: usdcAddress,
      },
      StardustVaultRouter: {
        address: routerAddress,
        dust: dustAddress,
        usdc: usdcAddress,
        vault: vaultAddress,
        uniswapRouter: uniswapRouterAddress,
      },
    },
    externalContracts: {
      USDC: usdcAddress,
      UniswapV3Router: uniswapRouterAddress,
    },
  };

  const outputPath = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("✅ 部署信息已保存:", outputPath);

  // ===== 7. 打印总结 =====
  console.log("\n" + "=".repeat(60));
  console.log("🎉 部署完成！");
  console.log("=".repeat(60));
  console.log("\n📋 合约地址：");
  console.log(`  DUSTToken:           ${dustAddress}`);
  console.log(`  DUSTBridge:          ${bridgeAddress}`);
  console.log(`  StardustTradingVault: ${vaultAddress}`);
  console.log(`  StardustVaultRouter:  ${routerAddress}`);
  console.log(`  USDC:                ${usdcAddress}`);
  console.log(`  Uniswap V3 Router:   ${uniswapRouterAddress}`);
  
  console.log("\n📝 下一步：");
  console.log("  1. 验证合约：npm run verify");
  console.log("  2. 创建 Uniswap 流动性池（DUST/USDC, stUSDC/USDC）");
  console.log("  3. 配置 OCW 中继服务");
  console.log("  4. 更新前端配置");
  console.log("\n" + "=".repeat(60) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

