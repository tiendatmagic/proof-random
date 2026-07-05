import { ethers } from "hardhat";

async function main() {
  const reqId = "114276765145748249196118428509468254100624323285120068078504874889633665958114";
  
  // Try Arbitrum Sepolia first
  console.log("Checking Arbitrum Sepolia...");
  try {
    const provider = new ethers.JsonRpcProvider("https://sepolia-rollup.arbitrum.io/rpc");
    const contract = new ethers.Contract(
      "0x509bbbbb45409d6e71cab8c919d921efe3a0a96b",
      [
        "function sessions(uint256) view returns (uint256, address, uint8, uint256, uint256, uint256, uint256, string, string, bool)",
        "function getSessionsCount() view returns (uint256)"
      ],
      provider
    );
    const session = await contract.sessions(reqId);
    console.log("Found on Sepolia!");
    console.log({
      requestId: session[0].toString(),
      creator: session[1],
      drawType: session[2],
      param1: session[3].toString(),
      param2: session[4].toString(),
      randomWord: session[5].toString(),
      timestamp: session[6].toString(),
      eventName: session[7],
      result: session[8],
      fulfilled: session[9]
    });
  } catch (e) {
    console.log("Not found on Sepolia or error:", (e as any).message);
  }

  // Try Arbitrum One
  console.log("Checking Arbitrum One...");
  try {
    const provider = new ethers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
    const contract = new ethers.Contract(
      "0x2491D0ed80EaF42308608F003ceC925929939a94",
      [
        "function sessions(uint256) view returns (uint256, address, uint8, uint256, uint256, uint256, uint256, string, string, bool)"
      ],
      provider
    );
    const session = await contract.sessions(reqId);
    console.log("Found on Arbitrum One!");
    console.log({
      requestId: session[0].toString(),
      creator: session[1],
      drawType: session[2],
      param1: session[3].toString(),
      param2: session[4].toString(),
      randomWord: session[5].toString(),
      timestamp: session[6].toString(),
      eventName: session[7],
      result: session[8],
      fulfilled: session[9]
    });
  } catch (e) {
    console.log("Not found on Arbitrum One or error:", (e as any).message);
  }
}

main().catch(console.error);
