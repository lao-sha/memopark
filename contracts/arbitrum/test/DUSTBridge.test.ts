import { expect } from "chai";
import { ethers } from "hardhat";
import { DUSTToken, DUSTBridge } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("DUSTBridge", function () {
  let dustToken: DUSTToken;
  let dustBridge: DUSTBridge;
  let owner: SignerWithAddress;
  let relayer: SignerWithAddress;
  let user: SignerWithAddress;

  beforeEach(async function () {
    [owner, relayer, user] = await ethers.getSigners();

    // 部署 DUST Token
    const DUSTTokenFactory = await ethers.getContractFactory("DUSTToken");
    dustToken = await DUSTTokenFactory.deploy();
    await dustToken.waitForDeployment();

    // 部署 Bridge
    const DUSTBridgeFactory = await ethers.getContractFactory("DUSTBridge");
    dustBridge = await DUSTBridgeFactory.deploy(
      await dustToken.getAddress()
    );
    await dustBridge.waitForDeployment();

    // 授予 Bridge BRIDGE_ROLE
    const BRIDGE_ROLE = await dustToken.BRIDGE_ROLE();
    await dustBridge.grantRole(BRIDGE_ROLE, await dustBridge.getAddress());
    await dustToken.grantRole(BRIDGE_ROLE, await dustBridge.getAddress());

    // 授予 relayer RELAYER_ROLE
    const RELAYER_ROLE = await dustBridge.RELAYER_ROLE();
    await dustBridge.grantRole(RELAYER_ROLE, relayer.address);
  });

  describe("部署", function () {
    it("应该正确设置 DUST token 地址", async function () {
      expect(await dustBridge.dustToken()).to.equal(await dustToken.getAddress());
    });

    it("应该授予部署者 DEFAULT_ADMIN_ROLE", async function () {
      const DEFAULT_ADMIN_ROLE = await dustBridge.DEFAULT_ADMIN_ROLE();
      expect(await dustBridge.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    });
  });

  describe("mint (铸造)", function () {
    const bridgeId = 1;
    const amount = ethers.parseEther("100");
    const txHash = ethers.encodeBytes32String("tx1");

    it("应该允许 relayer 铸造 DUST", async function () {
      await expect(
        dustBridge.connect(relayer).mint(
          bridgeId,
          user.address,
          amount,
          txHash
        )
      )
        .to.emit(dustBridge, "BridgeMint");

      expect(await dustToken.balanceOf(user.address)).to.equal(amount);
    });

    it("应该拒绝非 relayer 铸造", async function () {
      await expect(
        dustBridge.connect(user).mint(
          bridgeId,
          user.address,
          amount,
          txHash
        )
      ).to.be.reverted;
    });

    it("应该拒绝重复的 bridgeId", async function () {
      await dustBridge.connect(relayer).mint(
        bridgeId,
        user.address,
        amount,
        txHash
      );

      await expect(
        dustBridge.connect(relayer).mint(
          bridgeId,
          user.address,
          amount,
          ethers.encodeBytes32String("tx2")
        )
      ).to.be.revertedWith("DUSTBridge: already processed");
    });

    it("应该记录已处理的 bridgeId", async function () {
      const testBridgeId = 999;
      await dustBridge.connect(relayer).mint(
        testBridgeId,
        user.address,
        amount,
        txHash
      );

      expect(await dustBridge.processedBridgeIds(testBridgeId)).to.be.true;
    });
  });

  describe("burnAndBridgeBack (销毁)", function () {
    const amount = ethers.parseEther("100");
    const substrateAddress = ethers.encodeBytes32String("substrate");

    beforeEach(async function () {
      // 给用户铸造一些 DUST
      const bridgeId = 998;
      const txHash = ethers.encodeBytes32String("mint_for_burn");
      await dustBridge.connect(relayer).mint(bridgeId, user.address, amount, txHash);
    });

    it("应该允许用户销毁 DUST", async function () {
      await dustToken.connect(user).approve(await dustBridge.getAddress(), amount);

      await expect(
        dustBridge.connect(user).burnAndBridgeBack(amount, substrateAddress)
      )
        .to.emit(dustBridge, "BridgeBack");

      expect(await dustToken.balanceOf(user.address)).to.equal(0);
    });

    it("应该拒绝余额不足的销毁", async function () {
      const tooMuch = ethers.parseEther("200");
      await dustToken.connect(user).approve(await dustBridge.getAddress(), tooMuch);

      await expect(
        dustBridge.connect(user).burnAndBridgeBack(tooMuch, substrateAddress)
      ).to.be.reverted;
    });

    it("应该拒绝无效长度的 Substrate 地址", async function () {
      await dustToken.connect(user).approve(await dustBridge.getAddress(), amount);
      const shortAddress = ethers.hexlify(ethers.randomBytes(16)); // 16字节，不是32

      await expect(
        dustBridge.connect(user).burnAndBridgeBack(amount, shortAddress)
      ).to.be.revertedWith("DUSTBridge: invalid address length");
    });
  });

  describe("暂停功能", function () {
    const bridgeId = 100;
    const amount = ethers.parseEther("100");
    const txHash = ethers.encodeBytes32String("pause_test");

    it("应该允许管理员暂停", async function () {
      await dustBridge.pause();
      expect(await dustBridge.paused()).to.be.true;
    });

    it("应该允许管理员恢复", async function () {
      await dustBridge.pause();
      await dustBridge.unpause();
      expect(await dustBridge.paused()).to.be.false;
    });

    it("暂停后应该拒绝铸造", async function () {
      await dustBridge.pause();

      await expect(
        dustBridge.connect(relayer).mint(
          bridgeId,
          user.address,
          amount,
          txHash
        )
      ).to.be.reverted;
    });

    it("暂停后应该拒绝销毁", async function () {
      // 先铸造一些 DUST
      await dustBridge.connect(relayer).mint(bridgeId, user.address, amount, txHash);
      await dustToken.connect(user).approve(await dustBridge.getAddress(), amount);

      await dustBridge.pause();

      await expect(
        dustBridge.connect(user).burnAndBridgeBack(amount, ethers.encodeBytes32String("sub"))
      ).to.be.reverted;
    });

    it("应该拒绝非管理员暂停", async function () {
      await expect(dustBridge.connect(user).pause()).to.be.reverted;
    });
  });

  describe("角色管理", function () {
    it("应该允许管理员添加 relayer", async function () {
      const RELAYER_ROLE = await dustBridge.RELAYER_ROLE();
      await dustBridge.grantRole(RELAYER_ROLE, user.address);

      expect(await dustBridge.hasRole(RELAYER_ROLE, user.address)).to.be.true;
    });

    it("应该允许管理员移除 relayer", async function () {
      const RELAYER_ROLE = await dustBridge.RELAYER_ROLE();
      await dustBridge.revokeRole(RELAYER_ROLE, relayer.address);

      expect(await dustBridge.hasRole(RELAYER_ROLE, relayer.address)).to.be.false;
    });

    it("应该拒绝非管理员管理角色", async function () {
      const RELAYER_ROLE = await dustBridge.RELAYER_ROLE();
      await expect(
        dustBridge.connect(user).grantRole(RELAYER_ROLE, user.address)
      ).to.be.reverted;
    });
  });

  describe("边界条件", function () {
    const txHash = ethers.encodeBytes32String("boundary");

    it("应该处理零金额铸造", async function () {
      await expect(
        dustBridge.connect(relayer).mint(200, user.address, 0, txHash)
      ).to.be.revertedWith("DUSTBridge: amount too low");
    });

    it("应该处理零金额销毁", async function () {
      await expect(
        dustBridge.connect(user).burnAndBridgeBack(0, ethers.encodeBytes32String("sub"))
      ).to.be.revertedWith("DUSTBridge: amount too low");
    });

    it("应该处理零地址铸造", async function () {
      await expect(
        dustBridge.connect(relayer).mint(
          201,
          ethers.ZeroAddress,
          ethers.parseEther("100"),
          txHash
        )
      ).to.be.revertedWith("DUSTBridge: zero address");
    });

    it("应该处理大额铸造", async function () {
      const largeAmount = ethers.parseEther("1000000");
      await dustBridge.connect(relayer).mint(
        202,
        user.address,
        largeAmount,
        txHash
      );

      expect(await dustToken.balanceOf(user.address)).to.equal(largeAmount);
    });
  });

  describe("设置限额", function () {
    it("应该允许管理员设置最小/最大限额", async function () {
      const minAmount = ethers.parseEther("10");
      const maxAmount = ethers.parseEther("10000");

      await expect(
        dustBridge.setLimits(minAmount, maxAmount)
      ).to.emit(dustBridge, "LimitsUpdated").withArgs(minAmount, maxAmount);

      expect(await dustBridge.minBridgeAmount()).to.equal(minAmount);
      expect(await dustBridge.maxBridgeAmount()).to.equal(maxAmount);
    });

    it("应该拒绝非管理员设置限额", async function () {
      await expect(
        dustBridge.connect(user).setLimits(ethers.parseEther("10"), ethers.parseEther("10000"))
      ).to.be.reverted;
    });
  });
});
