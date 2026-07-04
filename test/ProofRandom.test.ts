import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";

describe("ProofRandom Contract", function () {
  let proofRandom: any;
  let vrfCoordinatorMock: any;
  let owner: Signer;
  let user1: Signer;
  let user2: Signer;
  let ownerAddress: string;
  let user1Address: string;
  let user2Address: string;

  const subscriptionId = 1;
  const keyHash = "0x127f568d7127814421b8a531e21b066060c2394d2162a56118d052a559869620";

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    user1Address = await user1.getAddress();
    user2Address = await user2.getAddress();

    // Deploy Mock Coordinator
    const VRFCoordinatorV2_5MockFactory = await ethers.getContractFactory("VRFCoordinatorV2_5Mock");
    vrfCoordinatorMock = await VRFCoordinatorV2_5MockFactory.deploy();

    // Deploy ProofRandom
    const ProofRandomFactory = await ethers.getContractFactory("ProofRandom");
    proofRandom = await ProofRandomFactory.deploy(
      await vrfCoordinatorMock.getAddress(),
      subscriptionId,
      keyHash
    );
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await proofRandom.owner()).to.equal(ownerAddress);
    });

    it("Should set the correct VRF config parameters", async function () {
      expect(await proofRandom.s_subscriptionId()).to.equal(subscriptionId);
      expect(await proofRandom.s_keyHash()).to.equal(keyHash);
    });
  });

  describe("VRF Config Update", function () {
    it("Should allow owner to update VRF config", async function () {
      const newSubId = 2;
      const newKeyHash = "0x127f568d7127814421b8a531e21b066060c2394d2162a56118d052a559869621";
      const newGasLimit = 500000;
      const newConfirmations = 5;

      await expect(proofRandom.updateVRFConfig(newSubId, newKeyHash, newGasLimit, newConfirmations))
        .to.emit(proofRandom, "VRFConfigUpdated")
        .withArgs(newSubId, newKeyHash, newGasLimit, newConfirmations);

      expect(await proofRandom.s_subscriptionId()).to.equal(newSubId);
      expect(await proofRandom.s_keyHash()).to.equal(newKeyHash);
      expect(await proofRandom.s_callbackGasLimit()).to.equal(newGasLimit);
      expect(await proofRandom.s_requestConfirmations()).to.equal(newConfirmations);
    });

    it("Should revert if non-owner tries to update VRF config", async function () {
      const newSubId = 2;
      const newKeyHash = "0x127f568d7127814421b8a531e21b066060c2394d2162a56118d052a559869621";
      await expect(
        proofRandom.connect(user1).updateVRFConfig(newSubId, newKeyHash, 400000, 3)
      ).to.be.reverted;
    });
  });

  describe("Request Draw", function () {
    it("Should fail if event name is empty", async function () {
      await expect(
        proofRandom.requestDraw(1, 1, 100, "", [])
      ).to.be.revertedWithCustomError(proofRandom, "InvalidInput");
    });

    it("Should fail if draw type is invalid", async function () {
      await expect(
        proofRandom.requestDraw(10, 1, 100, "Invalid Draw", [])
      ).to.be.revertedWithCustomError(proofRandom, "InvalidInput");
    });

    it("Should request draw successfully for Random Number", async function () {
      const tx = await proofRandom.requestDraw(1, 1, 100, "Random Number #1", []);
      const receipt = await tx.wait();

      const filter = proofRandom.filters.DrawRequested;
      const events = await proofRandom.queryFilter(filter, receipt.blockNumber);
      expect(events.length).to.equal(1);
      
      const requestId = events[0].args.requestId;
      expect(events[0].args.creator).to.equal(ownerAddress);
      expect(events[0].args.eventName).to.equal("Random Number #1");
      expect(events[0].args.drawType).to.equal(1);

      const session = await proofRandom.sessions(requestId);
      expect(session.creator).to.equal(ownerAddress);
      expect(session.drawType).to.equal(1);
      expect(session.param1).to.equal(1);
      expect(session.param2).to.equal(100);
      expect(session.fulfilled).to.be.false;
    });

    it("Should enforce anti-spam limit (block constraint)", async function () {
      try {
        // Tắt tự động đào block
        await ethers.provider.send("evm_setAutomine", [false]);

        // Gửi giao dịch 1 (sẽ nằm trong mempool)
        const tx1 = await proofRandom.connect(user1).requestDraw(4, 0, 0, "Coin Flip 1", []);

        // Gửi giao dịch 2 từ cùng một ví ngay lập tức (cũng nằm trong mempool)
        const tx2 = await proofRandom.connect(user1).requestDraw(4, 0, 0, "Coin Flip 2", []);

        // Đào block mới chứa cả 2 giao dịch tuần tự
        await ethers.provider.send("evm_mine", []);

        // Giao dịch 1 phải mine thành công
        const receipt1 = await tx1.wait();
        expect(receipt1.status).to.equal(1);

        // Giao dịch 2 phải bị revert khi mine vì vi phạm chống spam trong cùng block
        let tx2Reverted = false;
        try {
          await tx2.wait();
        } catch (err) {
          tx2Reverted = true;
        }
        expect(tx2Reverted).to.be.true;
      } finally {
        // Luôn bật lại tự động đào block trong mọi trường hợp
        await ethers.provider.send("evm_setAutomine", [true]);
      }
    });
  });

  describe("VRF Callback Fulfillment & Calculation Rules", function () {
    
    it("Should resolve Random Number (drawType 1)", async function () {
      const tx = await proofRandom.requestDraw(1, 10, 20, "Number 10-20", []);
      const receipt = await tx.wait();
      const requestId = (await proofRandom.queryFilter(proofRandom.filters.DrawRequested, receipt.blockNumber))[0].args.requestId;

      await expect(vrfCoordinatorMock.fulfillRandomWords(requestId, await proofRandom.getAddress()))
        .to.emit(proofRandom, "DrawFulfilled");

      const session = await proofRandom.sessions(requestId);
      expect(session.fulfilled).to.be.true;
      
      const val = parseInt(session.result);
      expect(val).to.be.gte(10);
      expect(val).to.be.lte(20);
    });

    it("Should resolve Random Name index (drawType 2)", async function () {
      const names = ["An", "Binh", "Cuong", "Dung", "Em"];
      const tx = await proofRandom.requestDraw(2, 5, 0, "Random Name 5", names);
      const receipt = await tx.wait();
      const requestId = (await proofRandom.queryFilter(proofRandom.filters.DrawRequested, receipt.blockNumber))[0].args.requestId;

      await vrfCoordinatorMock.fulfillRandomWords(requestId, await proofRandom.getAddress());

      const session = await proofRandom.sessions(requestId);
      expect(session.fulfilled).to.be.true;
      const index = parseInt(session.result);
      expect(index).to.be.gte(0);
      expect(index).to.be.lt(5);
    });

    it("Should resolve Multiple Winners indices (drawType 3)", async function () {
      const names = ["An", "Binh", "Cuong", "Dung", "Em", "Giang", "Hoa"];
      const tx = await proofRandom.requestDraw(3, 7, 3, "Select 3 from 7", names);
      const receipt = await tx.wait();
      const requestId = (await proofRandom.queryFilter(proofRandom.filters.DrawRequested, receipt.blockNumber))[0].args.requestId;

      await vrfCoordinatorMock.fulfillRandomWords(requestId, await proofRandom.getAddress());

      const session = await proofRandom.sessions(requestId);
      expect(session.fulfilled).to.be.true;
      
      const winners = session.result.split(",");
      expect(winners.length).to.equal(3);
      
      const uniqueWinners = new Set(winners);
      expect(uniqueWinners.size).to.equal(3);

      for(const winIndexStr of winners) {
        const idx = parseInt(winIndexStr);
        expect(idx).to.be.gte(0);
        expect(idx).to.be.lt(7);
      }
    });

    it("Should resolve Coin Flip (drawType 4)", async function () {
      const tx = await proofRandom.requestDraw(4, 0, 0, "Coin Flip Test", []);
      const receipt = await tx.wait();
      const requestId = (await proofRandom.queryFilter(proofRandom.filters.DrawRequested, receipt.blockNumber))[0].args.requestId;

      await vrfCoordinatorMock.fulfillRandomWords(requestId, await proofRandom.getAddress());

      const session = await proofRandom.sessions(requestId);
      expect(session.result).to.be.oneOf(["Heads", "Tails"]);
    });

    it("Should resolve Dice (drawType 5)", async function () {
      const tx = await proofRandom.requestDraw(5, 6, 0, "Dice 6-sided", []);
      const receipt = await tx.wait();
      const requestId = (await proofRandom.queryFilter(proofRandom.filters.DrawRequested, receipt.blockNumber))[0].args.requestId;

      await vrfCoordinatorMock.fulfillRandomWords(requestId, await proofRandom.getAddress());

      const session = await proofRandom.sessions(requestId);
      const side = parseInt(session.result);
      expect(side).to.be.gte(1);
      expect(side).to.be.lte(6);
    });

    it("Should resolve Even / Odd (drawType 6)", async function () {
      const tx = await proofRandom.requestDraw(6, 0, 0, "Even Odd Test", []);
      const receipt = await tx.wait();
      const requestId = (await proofRandom.queryFilter(proofRandom.filters.DrawRequested, receipt.blockNumber))[0].args.requestId;

      await vrfCoordinatorMock.fulfillRandomWords(requestId, await proofRandom.getAddress());

      const session = await proofRandom.sessions(requestId);
      expect(session.result).to.be.oneOf(["Even", "Odd"]);
    });

    it("Should resolve Random Color (drawType 7)", async function () {
      const tx = await proofRandom.requestDraw(7, 0, 0, "Color Test", []);
      const receipt = await tx.wait();
      const requestId = (await proofRandom.queryFilter(proofRandom.filters.DrawRequested, receipt.blockNumber))[0].args.requestId;

      await vrfCoordinatorMock.fulfillRandomWords(requestId, await proofRandom.getAddress());

      const session = await proofRandom.sessions(requestId);
      expect(session.result).to.match(/^#[0-9A-F]{6}$/);
    });

    it("Should resolve Random Letter (drawType 8)", async function () {
      const tx = await proofRandom.requestDraw(8, 0, 0, "Letter Test", []);
      const receipt = await tx.wait();
      const requestId = (await proofRandom.queryFilter(proofRandom.filters.DrawRequested, receipt.blockNumber))[0].args.requestId;

      await vrfCoordinatorMock.fulfillRandomWords(requestId, await proofRandom.getAddress());

      const session = await proofRandom.sessions(requestId);
      expect(session.result).to.match(/^[A-Z]$/);
    });
  });

  describe("Pausable Guard", function () {
    it("Should prevent requests when paused", async function () {
      await proofRandom.pause();
      
      await expect(
        proofRandom.requestDraw(4, 0, 0, "Paused Coin", [])
      ).to.be.reverted;
    });

    it("Should allow requests after unpaused", async function () {
      await proofRandom.pause();
      await proofRandom.unpause();

      await expect(
        proofRandom.requestDraw(4, 0, 0, "Unpaused Coin", [])
      ).to.emit(proofRandom, "DrawRequested");
    });
  });
});
