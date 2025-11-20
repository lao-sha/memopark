import { expect } from "chai";
import { ethers } from "hardhat";
import { StardustTradingVault } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("StardustTradingVault", function () {
  let vault: StardustTradingVault;
  let mockUSDC: any;
  let owner: SignerWithAddress;
  let ocw: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  beforeEach(async function () {
    [owner, ocw, user1, user2] = await ethers.getSigners();

    // 部署 Mock USDC
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    mockUSDC = await MockERC20Factory.deploy("Mock USDC", "mUSDC", 6);
    await mockUSDC.waitForDeployment();

    // 部署 Vault
    const VaultFactory = await ethers.getContractFactory("StardustTradingVault");
    vault = await VaultFactory.deploy(
      await mockUSDC.getAddress(),
      "Stardust Trading stUSDC",
      "stUSDC"
    );
    await vault.waitForDeployment();

    // 授予 OCW 权限
    const OCW_ROLE = await vault.OCW_ROLE();
    await vault.grantRole(OCW_ROLE, ocw.address);

    // 给用户铸造 USDC
    await mockUSDC.mint(user1.address, ethers.parseUnits("10000", 6));
    await mockUSDC.mint(user2.address, ethers.parseUnits("5000", 6));
  });

  describe("部署", function () {
    it("应该正确设置 USDC 地址", async function () {
      expect(await vault.usdc()).to.equal(await mockUSDC.getAddress());
    });

    it("应该初始化为 1:1 的份额比例", async function () {
      expect(await vault.getSharePrice()).to.equal(ethers.parseUnits("1", 6));
    });

    it("初始总供应量应为 0", async function () {
      expect(await vault.totalSupply()).to.equal(0);
    });
  });

  describe("deposit", function () {
    const depositAmount = ethers.parseUnits("1000", 6); // 1000 USDC

    beforeEach(async function () {
      await mockUSDC.connect(user1).approve(await vault.getAddress(), depositAmount);
    });

    it("应该允许用户存款并接收 stUSDC", async function () {
      await expect(vault.connect(user1).deposit(depositAmount))
        .to.emit(vault, "Deposited")
        .withArgs(user1.address, depositAmount, depositAmount);

      expect(await vault.balanceOf(user1.address)).to.equal(depositAmount);
      expect(await mockUSDC.balanceOf(await vault.getAddress())).to.equal(depositAmount);
    });

    it("应该正确计算份额（初始 1:1）", async function () {
      await vault.connect(user1).deposit(depositAmount);
      expect(await vault.balanceOf(user1.address)).to.equal(depositAmount);
    });

    it("应该拒绝零金额存款", async function () {
      await expect(vault.connect(user1).deposit(0)).to.be.revertedWith("Amount must be > 0");
    });

    it("应该拒绝余额不足的存款", async function () {
      const tooMuch = ethers.parseUnits("20000", 6);
      await mockUSDC.connect(user1).approve(await vault.getAddress(), tooMuch);
      await expect(vault.connect(user1).deposit(tooMuch)).to.be.reverted;
    });

    it("应该拒绝未批准的存款", async function () {
      await mockUSDC.connect(user2).approve(await vault.getAddress(), 0);
      await expect(vault.connect(user2).deposit(depositAmount)).to.be.reverted;
    });
  });

  describe("updateNetAssetValue", function () {
    const depositAmount = ethers.parseUnits("1000", 6);

    beforeEach(async function () {
      await mockUSDC.connect(user1).approve(await vault.getAddress(), depositAmount);
      await vault.connect(user1).deposit(depositAmount);
    });

    it("应该允许 OCW 更新 NAV", async function () {
      const newNav = ethers.parseUnits("1100", 6); // 10% 收益
      await expect(vault.connect(ocw).updateNetAssetValue(newNav))
        .to.emit(vault, "NAVUpdated")
        .withArgs(newNav, ethers.parseUnits("1.1", 6));
    });

    it("应该正确更新份额价格（上涨）", async function () {
      const newNav = ethers.parseUnits("1100", 6);
      await vault.connect(ocw).updateNetAssetValue(newNav);

      const sharePrice = await vault.getSharePrice();
      expect(sharePrice).to.equal(ethers.parseUnits("1.1", 6));
    });

    it("应该正确更新份额价格（下跌）", async function () {
      const newNav = ethers.parseUnits("900", 6);
      await vault.connect(ocw).updateNetAssetValue(newNav);

      const sharePrice = await vault.getSharePrice();
      expect(sharePrice).to.equal(ethers.parseUnits("0.9", 6));
    });

    it("应该拒绝非 OCW 更新", async function () {
      await expect(
        vault.connect(user1).updateNetAssetValue(ethers.parseUnits("1100", 6))
      ).to.be.reverted;
    });

    it("应该拒绝零 NAV", async function () {
      await expect(vault.connect(ocw).updateNetAssetValue(0)).to.be.revertedWith("NAV must be > 0");
    });
  });

  describe("多用户存款场景", function () {
    it("应该正确处理多个用户的存款", async function () {
      const amount1 = ethers.parseUnits("1000", 6);
      const amount2 = ethers.parseUnits("500", 6);

      await mockUSDC.connect(user1).approve(await vault.getAddress(), amount1);
      await vault.connect(user1).deposit(amount1);

      await mockUSDC.connect(user2).approve(await vault.getAddress(), amount2);
      await vault.connect(user2).deposit(amount2);

      expect(await vault.balanceOf(user1.address)).to.equal(amount1);
      expect(await vault.balanceOf(user2.address)).to.equal(amount2);
      expect(await vault.totalSupply()).to.equal(amount1 + amount2);
    });

    it("NAV 变化后的存款应该获得正确的份额", async function () {
      // User1 存入 1000 USDC
      const amount1 = ethers.parseUnits("1000", 6);
      await mockUSDC.connect(user1).approve(await vault.getAddress(), amount1);
      await vault.connect(user1).deposit(amount1);

      // OCW 更新 NAV（20% 收益）
      await vault.connect(ocw).updateNetAssetValue(ethers.parseUnits("1200", 6));

      // User2 存入 600 USDC（份额价格现在是 1.2）
      const amount2 = ethers.parseUnits("600", 6);
      await mockUSDC.connect(user2).approve(await vault.getAddress(), amount2);
      await vault.connect(user2).deposit(amount2);

      // User2 应该获得 500 份额（600 / 1.2）
      expect(await vault.balanceOf(user2.address)).to.equal(ethers.parseUnits("500", 6));
    });
  });

  describe("getSharePrice", function () {
    it("初始份额价格应该是 1.0", async function () {
      expect(await vault.getSharePrice()).to.equal(ethers.parseUnits("1", 6));
    });

    it("NAV 变化应该影响份额价格", async function () {
      const depositAmount = ethers.parseUnits("1000", 6);
      await mockUSDC.connect(user1).approve(await vault.getAddress(), depositAmount);
      await vault.connect(user1).deposit(depositAmount);

      // NAV 增加 50%
      await vault.connect(ocw).updateNetAssetValue(ethers.parseUnits("1500", 6));
      expect(await vault.getSharePrice()).to.equal(ethers.parseUnits("1.5", 6));
    });
  });

  describe("暂停功能", function () {
    it("应该允许管理员暂停", async function () {
      await vault.pause();
      expect(await vault.paused()).to.be.true;
    });

    it("应该允许管理员恢复", async function () {
      await vault.pause();
      await vault.unpause();
      expect(await vault.paused()).to.be.false;
    });

    it("暂停后应该拒绝存款", async function () {
      await vault.pause();
      await mockUSDC.connect(user1).approve(await vault.getAddress(), ethers.parseUnits("1000", 6));
      await expect(vault.connect(user1).deposit(ethers.parseUnits("1000", 6))).to.be.reverted;
    });

    it("应该拒绝非管理员暂停", async function () {
      await expect(vault.connect(user1).pause()).to.be.reverted;
    });
  });

  describe("ERC20 功能", function () {
    const depositAmount = ethers.parseUnits("1000", 6);

    beforeEach(async function () {
      await mockUSDC.connect(user1).approve(await vault.getAddress(), depositAmount);
      await vault.connect(user1).deposit(depositAmount);
    });

    it("应该允许转移 stUSDC", async function () {
      const transferAmount = ethers.parseUnits("100", 6);
      await vault.connect(user1).transfer(user2.address, transferAmount);

      expect(await vault.balanceOf(user1.address)).to.equal(
        depositAmount - transferAmount
      );
      expect(await vault.balanceOf(user2.address)).to.equal(transferAmount);
    });

    it("应该允许批准和 transferFrom", async function () {
      const transferAmount = ethers.parseUnits("100", 6);
      await vault.connect(user1).approve(user2.address, transferAmount);
      await vault.connect(user2).transferFrom(user1.address, user2.address, transferAmount);

      expect(await vault.balanceOf(user1.address)).to.equal(
        depositAmount - transferAmount
      );
      expect(await vault.balanceOf(user2.address)).to.equal(transferAmount);
    });

    it("应该拒绝超额转移", async function () {
      const tooMuch = ethers.parseUnits("2000", 6);
      await expect(vault.connect(user1).transfer(user2.address, tooMuch)).to.be.reverted;
    });
  });
});

