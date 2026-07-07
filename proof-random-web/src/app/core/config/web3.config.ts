import { environment } from '../../../environments/environment';

export const WEB3_CONFIG = {
  // Đọc động từ environments của Angular
  walletConnectProjectId: environment.walletConnectProjectId, 

  // Mạng mặc định (421614: Arbitrum Sepolia, 42161: Arbitrum One)
  defaultChainId: environment.defaultChainId, 

  contracts: {
    '42161': environment.contracts.arbitrum,
    '421614': environment.contracts.arbitrumSepolia
  } as Record<string, string>,

  rpcs: {
    '42161': "https://arb1.arbitrum.io/rpc",
    '421614': "https://sepolia-rollup.arbitrum.io/rpc"
  } as Record<string, string>,

  explorers: {
    '42161': "https://arbiscan.io",
    '421614': "https://sepolia.arbiscan.io"
  } as Record<string, string>
};
