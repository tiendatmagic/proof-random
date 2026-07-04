import { environment } from '../../../environments/environment';

export const WEB3_CONFIG = {
  // Đọc động từ environments của Angular
  walletConnectProjectId: environment.walletConnectProjectId, 

  // Mạng mặc định (421614: Arbitrum Sepolia, 42161: Arbitrum One)
  defaultChainId: environment.defaultChainId, 

  contracts: {
    arbitrumSepolia: environment.contracts.arbitrumSepolia,
    arbitrum: environment.contracts.arbitrum
  },

  rpcs: {
    arbitrumSepolia: "https://sepolia-rollup.arbitrum.io/rpc",
    arbitrum: "https://arb1.arbitrum.io/rpc"
  },

  explorers: {
    arbitrumSepolia: "https://sepolia.arbiscan.io",
    arbitrum: "https://arbiscan.io"
  }
};
