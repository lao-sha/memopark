import { expect } from "chai";
import { ethers } from "hardhat";
import { StardustVaultRouter, StardustTradingVault, DUSTToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("StardustVaultRouter", function () {
  let router: StardustVaultRouter;
  let vault: StardustTradingVault;
  let dustToken: DUSTToken;
  let mockUSDC: any;
  let mockUniswap: any;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;

  const INITIAL_DUST = ethers.parseEther("10000");
  const INITIAL_USDC = ethers.parseUnits("10000", 6);

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    // 部署 Mock USDC
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    mockUSDC = await MockERC20Factory.deploy("Mock USDC", "mUSDC", 6);
    await mockUSDC.waitForDeployment();

    // 部署 DUST Token
    const DUSTTokenFactory = await ethers.getContractFactory("DUSTToken");
    dustToken = await DUSTTokenFactory.deploy();
    await dustToken.waitForDeployment();

    // 部署 Vault
    const VaultFactory = await ethers.getContractFactory("StardustTradingVault");
    vault = await VaultFactory.deploy(
      await mockUSDC.getAddress(),
      "Stardust Trading stUSDC",
      "stUSDC"
    );
    await vault.waitForDeployment();

    // 部署 Mock Uniswap Router
    const MockUniswapFactory = await ethers.getContractFactory("MockUniswapRouter");
    mockUniswap = await MockUniswapFactory.deploy();
    await mockUniswap.waitForDeployment();

    // 部署 Router
    const RouterFactory = await ethers.getContractFactory("StardustVaultRouter");
    router = await RouterFactory.deploy(
      await dustToken.getAddress(),
      await mockUSDC.getAddress(),
      await vault.getAddress(),
      await mockUniswap.getAddress()
    );
    await router.waitForDeployment();

    // 授予 Router 权限
    const ROUTER_ROLE = await vault.ROUTER_ROLE();
    await vault.grantRole(ROUTER_ROLE, await router.getAddress());

    // 给用户铸造代币
    const BRIDGE_ROLE = await dustToken.BRIDGE_ROLE();
    await dustToken.grantRole(BRIDGE_ROLE, owner.address);
    await dustToken.mint(user.address, INITIAL_DUST, ethers.encodeBytes32String("test"));
    await mockUSDC.mint(user.address, INITIAL_USDC);

    // 给 Uniswap 添加流动性（模拟）
    await dustToken.mint(await mockUniswap.getAddress(), ethers.parseEther("1000000"), ethers.encodeBytes32String("liquidity"));
    await mockUSDC.mint(await mockUniswap.getAddress(), ethers.parseUnits("1000000", 6));
  });

  describe("部署", function () {
    it("应该正确设置所有地址", async function () {
      expect(await router.dustToken()).to.equal(await dustToken.getAddress());
      expect(await router.usdc()).to.equal(await mockUSDC.getAddress());
      expect(await router.vault()).to.equal(await vault.getAddress());
      expect(await router.uniswapRouter()).to.equal(await mockUniswap.getAddress());
    });
  });

  describe("depositWithDUST", function () {
    const dustAmount = ethers.parseEther("1000"); // 1000 DUST

    beforeEach(async function () {
      await dustToken.connect(user).approve(await router.getAddress(), dustAmount);
    });

    it("应该允许用户用 DUST 存款", async function () {
      const tx = await router.connect(user).depositWithDUST(
        dustAmount,
        0 // minUsdcOut
      );

      await expect(tx).to.emit(router, "DepositedWithDUST");
    });

    it("应该拒绝零金额存款", async function () {
      await expect(
        router.connect(user).depositWithDUST(0, 0)
      ).to.be.revertedWith("Amount must be > 0");
    });

    it("应该拒绝未批准的存款", async function () {
      await dustToken.connect(user).approve(await router.getAddress(), 0);
      await expect(
        router.connect(user).depositWithDUST(dustAmount, 0)
      ).to.be.reverted;
    });

    it("应该执行 DUST -> USDC 兑换", async function () {
      const dustBalanceBefore = await dustToken.balanceOf(user.address);
      await router.connect(user).depositWithDUST(dustAmount, 0);
      const dustBalanceAfter = await dustToken.balanceOf(user.address);

      expect(dustBalanceBefore - dustBalanceAfter).to.equal(dustAmount);
    });

    it("应该将 USDC 存入 Vault", async function () {
      await router.connect(user).depositWithDUST(dustAmount, 0);
      expect(await vault.balanceOf(user.address)).to.be.gt(0);
    });
  });

  describe("withdrawToDUST", function () {
    const stUsdcAmount = ethers.parseUnits("1000", 6); // 1000 stUSDC

    beforeEach(async function () {
      // 用户先存入一些
      const dustAmount = ethers.parseEther("1000");
      await dustToken.connect(user).approve(await router.getAddress(), dustAmount);
      await router.connect(user).depositWithDUST(dustAmount, 0);
      
      // 批准 Router 花费 stUSDC
      await vault.connect(user).approve(await router.getAddress(), stUsdcAmount);
    });

    it("应该允许用户提取到 DUST", async function () {
      const tx = await router.connect(user).withdrawToDUST(
        stUsdcAmount,
        0, // minUsdcOut
        0  // minDustOut
      );

      await expect(tx).to.emit(router, "WithdrawnToDUST");
    });

    it("应该拒绝零金额提取", async function () {
      await expect(
        router.connect(user).withdrawToDUST(0, 0, 0)
      ).to.be.revertedWith("Router: zero amount");
    });

    it("应该拒绝未批准的提取", async function () {
      await vault.connect(user).approve(await router.getAddress(), 0);
      await expect(
        router.connect(user).withdrawToDUST(stUsdcAmount, 1, 1)
      ).to.be.reverted;
    });

    it("应该销毁 stUSDC", async function () {
      const stUsdcBalanceBefore = await vault.balanceOf(user.address);
      await router.connect(user).withdrawToDUST(stUsdcAmount, 0, 0);
      const stUsdcBalanceAfter = await vault.balanceOf(user.address);

      expect(stUsdcBalanceBefore - stUsdcBalanceAfter).to.equal(stUsdcAmount);
    });

    it("应该返回 DUST 给用户", async function () {
      const dustBalanceBefore = await dustToken.balanceOf(user.address);
      await router.connect(user).withdrawToDUST(stUsdcAmount, 0, 0);
      const dustBalanceAfter = await dustToken.balanceOf(user.address);

      expect(dustBalanceAfter).to.be.gt(dustBalanceBefore);
    });
  });

  describe("滑点保护", function () {
    const dustAmount = ethers.parseEther("1000");

    beforeEach(async function () {
      await dustToken.connect(user).approve(await router.getAddress(), dustAmount);
    });

    it("应该在滑点过大时拒绝存款", async function () {
      const minUsdcOut = ethers.parseUnits("10000", 6); // 不合理的高最小值
      await expect(
        router.connect(user).depositWithDUST(dustAmount, minUsdcOut)
      ).to.be.reverted;
    });

    it("应该在滑点过大时拒绝提取", async function () {
      // 先存入
      await router.connect(user).depositWithDUST(dustAmount, 0);
      
      // 尝试提取
      const stUsdcAmount = await vault.balanceOf(user.address);
      await vault.connect(user).approve(await router.getAddress(), stUsdcAmount);
      
      const minUsdcOut = ethers.parseUnits("10000", 6); // 不合理的高最小值
      const minDustOut = ethers.parseEther("10000"); // 不合理的高最小值
      await expect(
        router.connect(user).withdrawToDUST(stUsdcAmount, minUsdcOut, minDustOut)
      ).to.be.reverted;
    });
  });

  describe("紧急提取", function () {
    it("应该允许管理员紧急提取 ERC20", async function () {
      // 向 Router 发送一些代币（模拟意外转账）
      await dustToken.transfer(await router.getAddress(), ethers.parseEther("100"));

      await router.emergencyWithdraw(
        await dustToken.getAddress(),
        owner.address,
        ethers.parseEther("100")
      );

      expect(await dustToken.balanceOf(owner.address)).to.be.gt(0);
    });

    it("应该拒绝非管理员紧急提取", async function () {
      await expect(
        router.connect(user).emergencyWithdraw(
          await dustToken.getAddress(),
          user.address,
          ethers.parseEther("100")
        )
      ).to.be.reverted;
    });
  });

  describe("暂停功能", function () {
    const dustAmount = ethers.parseEther("1000");

    beforeEach(async function () {
      await dustToken.connect(user).approve(await router.getAddress(), dustAmount);
    });

    it("应该允许管理员暂停", async function () {
      await router.pause();
      expect(await router.paused()).to.be.true;
    });

    it("暂停后应该拒绝存款", async function () {
      await router.pause();
      await expect(
        router.connect(user).depositWithDUST(dustAmount, 0)
      ).to.be.reverted;
    });

    it("暂停后应该拒绝提取", async function () {
      // 先存入
      await router.connect(user).depositWithDUST(dustAmount, 0);
      
      // 暂停
      await router.pause();
      
      // 尝试提取
      const stUsdcAmount = await vault.balanceOf(user.address);
      await vault.connect(user).approve(await router.getAddress(), stUsdcAmount);
      await expect(
        router.connect(user).withdrawToDUST(stUsdcAmount, 0, 0)
      ).to.be.reverted;
    });
  });
});

