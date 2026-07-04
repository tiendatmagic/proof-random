import { ethers, network } from "hardhat";

async function main() {
  console.log(`====================================================`);
  console.log(`Đang chạy script deploy trên mạng: ${network.name}`);
  console.log(`====================================================`);

  let vrfCoordinatorAddress: string;
  let subscriptionId: string | number;
  let keyHash: string;

  // Cấu hình demo mặc định cho Chainlink VRF v2.5 trên các mạng EVM
  const VRF_CONFIGS: Record<string, { coordinator: string; keyHash: string; defaultSubId: number }> = {
    arbitrumSepolia: {
      coordinator: "0x5C210e48983947b7F8Ee713D9b1E003565e3F030",
      keyHash: "0x127f568d7127814421b8a531e21b066060c2394d2162a56118d052a559869620", // 100 gwei Key Hash
      defaultSubId: 0, // Cần điền subId thực tế của bạn
    },
    arbitrum: {
      coordinator: "0x410714c4054FF305C013233df0C6bCD829dF57fA",
      keyHash: "0x0eb3be7a4192b450700a0f51390df0e7b952f447781d4517316717f9e8a7153b", // 100 gwei Key Hash
      defaultSubId: 0, // Cần điền subId thực tế của bạn
    }
  };

  if (network.name === "hardhat" || network.name === "localhost") {
    console.log("Môi trường local phát hiện! Đang deploy Mock VRF Coordinator...");
    
    const VRFCoordinatorV2_5MockFactory = await ethers.getContractFactory("VRFCoordinatorV2_5Mock");
    const mockCoordinator = await VRFCoordinatorV2_5MockFactory.deploy();
    vrfCoordinatorAddress = await mockCoordinator.getAddress();
    subscriptionId = 1; // SubID giả lập cho local
    keyHash = "0x127f568d7127814421b8a531e21b066060c2394d2162a56118d052a559869620";

    console.log(`Mock VRF Coordinator deployed thành công tại: ${vrfCoordinatorAddress}`);
  } else {
    // Mạng thật (Arbitrum Sepolia hoặc Arbitrum One)
    const config = VRF_CONFIGS[network.name];
    if (!config) {
      throw new Error(`Chưa có cấu hình Chainlink VRF cho mạng ${network.name}. Vui lòng bổ sung.`);
    }

    vrfCoordinatorAddress = config.coordinator;
    keyHash = config.keyHash;
    
    // Đọc subscriptionId từ environment variable hoặc dùng giá trị mặc định (sẽ nhắc người dùng)
    const envSubId = process.env.VRF_SUBSCRIPTION_ID;
    if (envSubId) {
      subscriptionId = envSubId;
      console.log(`Sử dụng Subscription ID từ ENV: ${subscriptionId}`);
    } else {
      subscriptionId = config.defaultSubId;
      console.log(`⚠️ CẢNH BÁO: Chưa tìm thấy VRF_SUBSCRIPTION_ID trong file .env.`);
      console.log(`Đang sử dụng Subscription ID demo mặc định: ${subscriptionId}`);
      console.log(`Vui lòng đăng ký subscription tại https://vrf.chain.link/ và cập nhật file .env để chạy thực tế.`);
    }
  }

  console.log(`Đang tiến hành deploy contract ProofRandom...`);
  const ProofRandomFactory = await ethers.getContractFactory("ProofRandom");
  const proofRandom = await ProofRandomFactory.deploy(
    vrfCoordinatorAddress,
    subscriptionId,
    keyHash
  );

  await proofRandom.waitForDeployment();
  const proofRandomAddress = await proofRandom.getAddress();

  console.log(`====================================================`);
  console.log(`🎉 Deploy ProofRandom THÀNH CÔNG!`);
  console.log(`Địa chỉ contract: ${proofRandomAddress}`);
  console.log(`VRF Coordinator: ${vrfCoordinatorAddress}`);
  console.log(`Subscription ID: ${subscriptionId}`);
  console.log(`Key Hash: ${keyHash}`);
  console.log(`====================================================`);

  if (network.name === "hardhat" || network.name === "localhost") {
    console.log(`💡 Mẹo local: Để kích hoạt bốc thăm giả lập, bạn có thể gọi mockCoordinator.fulfillRandomWords(requestId, ${proofRandomAddress}) sau khi gửi requestDraw.`);
  } else {
    console.log(`💡 Vui lòng thực hiện các bước sau để contract hoạt động chính xác:`);
    console.log(`1. Truy cập https://vrf.chain.link/ để thêm ví contract này [${proofRandomAddress}] làm Consumer cho Subscription ID [${subscriptionId}] của bạn.`);
    console.log(`2. Nạp một ít LINK/Native token vào Subscription ID của bạn để trả phí gas cho Chainlink VRF.`);
    console.log(`3. Để verify contract trên Arbiscan, hãy chạy lệnh:`);
    console.log(`   npx hardhat verify --network ${network.name} ${proofRandomAddress} "${vrfCoordinatorAddress}" "${subscriptionId}" "${keyHash}"`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
