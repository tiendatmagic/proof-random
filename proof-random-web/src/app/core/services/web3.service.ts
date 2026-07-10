import { Injectable, signal, computed, effect } from '@angular/core';
import { BrowserProvider, Contract, JsonRpcProvider, formatEther, Interface, solidityPackedKeccak256 } from 'ethers';
import { WEB3_CONFIG } from '../config/web3.config';
import { PROOF_RANDOM_ABI } from './proof-random-abi';

// ABI tối giản của Chainlink VRF Coordinator V2Plus để đọc thông tin subscription
const VRF_COORDINATOR_ABI = [
  'function getSubscription(uint256 subId) view returns (uint96 balance, uint96 nativeBalance, uint64 reqCount, address owner, address[] consumers)'
];

export interface DashboardStats {
  totalSessions: number;
  totalDraws: number;
  linkBalance: string;
  subscriptionId: string;
  recentDraws: any[];
}

// Tích hợp Reown AppKit cho WalletConnect
import { createAppKit } from '@reown/appkit';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { arbitrum, arbitrumSepolia } from '@reown/appkit/networks';

@Injectable({
  providedIn: 'root'
})
export class Web3Service {
  // Trạng thái kết nối ví của người dùng
  public readonly walletConnected = signal<boolean>(false);
  public readonly currentAccount = signal<string>('');
  public readonly walletBalance = signal<string>('0.00');
  public readonly chainId = signal<string>('');
  public readonly walletError = signal<string>('');
  public readonly isInitializing = signal<boolean>(true);

  // Trạng thái cấu hình Gas của dApp (mặc định, nhanh x2, tùy chỉnh)
  public readonly gasMode = signal<'default' | 'fast' | 'custom'>('fast');
  public readonly gasMultiplier = signal<number>(2.0);

  // Cấu hình mạng mặc định và contract hiện hành (Khôi phục từ localStorage để tránh reload bị reset mạng)
  public readonly configuredChainId = signal<string>(
    (typeof window !== 'undefined' && localStorage.getItem('proof_random_configured_chain_id')) || WEB3_CONFIG.defaultChainId
  );

  public readonly activeNetwork = computed(() => {
    const chainId = this.configuredChainId();
    switch (chainId) {
      case '42161': return 'arbitrum';
      case '421614': return 'arbitrumSepolia';
      default: return 'arbitrumSepolia';
    }
  });

  public readonly contractAddress = computed(() => {
    const chainId = this.configuredChainId();
    return WEB3_CONFIG.contracts[chainId] || '0x0000000000000000000000000000000000000000';
  });

  public readonly rpcUrl = computed(() => {
    const chainId = this.configuredChainId();
    return WEB3_CONFIG.rpcs[chainId] || WEB3_CONFIG.rpcs[WEB3_CONFIG.defaultChainId];
  });

  public readonly explorerUrl = computed(() => {
    const chainId = this.configuredChainId();
    return WEB3_CONFIG.explorers[chainId] || WEB3_CONFIG.explorers[WEB3_CONFIG.defaultChainId];
  });

  // Getters lấy cache lịch sử bốc thăm phục vụ cho các components
  public get historyCacheDraws(): any[] {
    const chainId = this.configuredChainId().toString();
    return this._allDrawsCache[chainId] || [];
  }

  public get historyHasFullScan(): boolean {
    const chainId = this.configuredChainId().toString();
    return !!this._hasFullScan[chainId];
  }

  // Địa chỉ ví rút gọn (0x1234...abcd)
  public readonly shortAddress = computed(() => {
    const addr = this.currentAccount();
    if (!addr) return '';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  });

  // Kiểm tra xem ví có đang kết nối lệch mạng so với dApp đang chọn hay không
  // AN TOÀN: Nếu chainId ví đang rỗng "", tạm thời coi là không lệch mạng để tránh blocker modal che phủ lúc tải trang
  public readonly isWrongChain = computed(() => {
    if (this.isInitializing()) return false;
    if (!this.walletConnected()) return false;
    const connectedChain = this.chainId().toString().trim();
    const configChain = this.configuredChainId().toString().trim();
    if (!connectedChain) return false;
    return connectedChain !== configChain;
  });

  // Tên mạng đang được sử dụng
  public readonly networkName = computed(() => {
    const id = this.walletConnected() ? this.chainId() : this.configuredChainId();
    const idStr = id.toString().trim();
    if (idStr === '42161') return 'Arbitrum One';
    if (idStr === '421614') return 'Arbitrum Sepolia';
    if (idStr === '31337' || idStr === '1337') return 'Hardhat Localhost';
    return `Mạng EVM khác (ID: ${id})`;
  });

  // Ký hiệu native token
  public readonly networkSymbol = computed(() => {
    return 'ETH';
  });

  private modal: any = null;
  private appKitIsConnected = false;
  private isSwitchingNetwork = false;

  // Cache lưu trữ lịch sử bốc thăm đã quét theo chainId
  private _allDrawsCache: Record<string, any[]> = {};
  private _hasFullScan: Record<string, boolean> = {};

  // Cache chi tiết phiên bốc thăm theo chainId và requestId
  private _drawSessionDetailsCache: Record<string, Record<string, any>> = {};

  // Cache thống kê Dashboard theo chainId
  private _dashboardStatsCache: Record<string, { stats: DashboardStats; timestamp: number }> = {};

  // Cache phân trang lịch sử bốc thăm theo chainId và page
  private _paginatedDrawsCache: Record<string, Record<number, { draws: any[], total: number, timestamp: number }>> = {};

  constructor() {
    this.loadGasSettings();
    this.bootstrapAppKit();

    // Tự động nạp cache từ sessionStorage khi configuredChainId thay đổi
    effect(() => {
      this.configuredChainId();
      this.loadCacheFromSessionStorage();
    });

    // Tự động lưu configuredChainId được chọn vào localStorage để không bị mất khi reload
    effect(() => {
      const chain = this.configuredChainId();
      if (typeof window !== 'undefined' && chain) {
        localStorage.setItem('proof_random_configured_chain_id', chain);
      }
    });

    // Tự động đồng bộ configuredChainId (dApp context) với chainId thực tế của ví nếu đó là chain hợp lệ
    // Giải quyết lỗi popup "Sai mạng lưới" khi user đang dùng chain được hỗ trợ (vd: Sepolia) nhưng dApp lại lưu cache của chain khác (vd: One)
    effect(() => {
      const connectedChain = this.chainId().toString().trim();
      const configChain = this.configuredChainId().toString().trim();
      const supportedChains = ['42161', '421614', '31337', '1337'];

      if (this.walletConnected() && supportedChains.includes(connectedChain)) {
        if (configChain !== connectedChain) {
          this.configuredChainId.set(connectedChain);
          if (typeof window !== 'undefined') {
            localStorage.setItem('proof_random_configured_chain_id', connectedChain);
          }
        }
      }
    }, { allowSignalWrites: true });

    // Tự động điều chỉnh chế độ gas mặc định dựa theo mạng lưới đang hoạt động
    effect(() => {
      const currentChain = this.walletConnected() ? this.chainId() : this.configuredChainId();
      if (currentChain === '42161') {
        this.gasMode.set('default');
      } else {
        const savedMode = localStorage.getItem('proof_random_gas_mode') as 'default' | 'fast' | 'custom' | null;
        this.gasMode.set(savedMode || 'fast');
      }
    }, { allowSignalWrites: true });
    // Tự động đồng bộ configuredChainId xuống AppKit modal để modal gọi đúng chain khi bấm connect
    // CHÚ Ý: Chỉ đồng bộ khi người dùng chủ động đổi mạng (configuredChainId thay đổi).
    // Dùng untracked() cho walletConnected để effect không bị trigger lại khi ví đang trong quá trình kết nối.
    let previousChainId = this.configuredChainId();
    effect(() => {
      const currentChainId = this.configuredChainId();
      if (currentChainId !== previousChainId) {
        previousChainId = currentChainId;
        // Import untracked dynamically if needed, or use a workaround if untracked is not imported in proof-random
        // Wait, I might not have imported untracked in proof-random! Let's check imports.
        // Actually I can just avoid `untracked` if I only rely on `previousChainId`.
        // Wait, if I don't use `untracked`, then `this.walletConnected()` WILL be tracked!
        // But since I use `currentChainId !== previousChainId`, the block inside the `if` ONLY executes when `currentChainId` changes!
        // So even if the effect runs because `walletConnected` changed, the `if` condition will be FALSE, so it does nothing!
        // THIS IS BRILLIANT and doesn't require `untracked`!
        if (this.modal && !this.walletConnected()) {
          const net = this.getAppKitNetworkByChainId(currentChainId);
          if (net) {
            this.modal.switchNetwork(net).catch(() => {});
          }
        }
      }
    });

  }

  /**
   * Khởi tạo các thành phần Web3 bất đồng bộ để đảm bảo có thể dọn dẹp cache rác trước khi boot AppKit
   */
  private async bootstrapAppKit() {
    await this.cleanWalletConnectCache();
    this.initAppKit();
    this.setupEthereumListeners();
    this.restoreSessionFromStorage();
    this.checkConnectedAccounts();

    // Hoàn tất giai đoạn khởi tạo AppKit sau 2 giây để tránh nháy sai chain blocker
    setTimeout(() => {
      this.isInitializing.set(false);
    }, 2000);
  }

  /**
   * Tính năng tự chữa lành (Self-healing): Dọn dẹp triệt để các phiên (session) bị kẹt của WalletConnect
   * Chỉ thực hiện khi người dùng KHÔNG CÓ phiên kết nối hợp lệ (chưa đăng nhập), để không làm mất session đang dùng.
   */
  private async cleanWalletConnectCache(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const savedAccount = localStorage.getItem('proof_random_connected_account');
      if (!savedAccount) {
        // 1. Dọn dẹp LocalStorage
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('wc@2') || key.startsWith('@w3m') || key.startsWith('@appkit')) {
            localStorage.removeItem(key);
          }
        });
        
        // 2. Dọn dẹp IndexedDB (nơi WalletConnect lưu state)
        if (typeof window.indexedDB !== 'undefined') {
          await new Promise<void>((resolve) => {
            const req = window.indexedDB.deleteDatabase('WALLET_CONNECT_V2_INDEXED_DB');
            req.onsuccess = () => resolve();
            req.onerror = () => resolve(); // Bỏ qua lỗi nếu database bị lock
            req.onblocked = () => resolve();
          });
        }
      }
    } catch (e) {
      console.warn('[Web3] Dọn dẹp cache WalletConnect lỗi:', e);
    }
  }





  /**
   * Đọc cấu hình cài đặt gas từ localStorage
   */
  private loadGasSettings() {
    if (typeof window === 'undefined') return;
    try {
      const mode = localStorage.getItem('proof_random_gas_mode') as 'default' | 'fast' | 'custom' | null;
      if (mode) this.gasMode.set(mode);
      const mult = localStorage.getItem('proof_random_gas_multiplier');
      if (mult) this.gasMultiplier.set(parseFloat(mult));
    } catch (e) {
      console.warn('[Web3] Không thể đọc cài đặt gas từ localStorage:', e);
    }
  }

  /**
   * Khôi phục phiên kết nối ví đã lưu ở localStorage
   */
  private async restoreSessionFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const savedAccount = localStorage.getItem('proof_random_connected_account');
      const connectionType = localStorage.getItem('proof_random_connection_type');
      if (savedAccount) {
        this.currentAccount.set(savedAccount);
        this.walletConnected.set(true);
        this.appKitIsConnected = connectionType === 'appkit';
        await this.updateBalanceAndStatus(savedAccount);
      }
    } catch (e) {
      console.warn('[Web3] Không thể khôi phục phiên kết nối ví:', e);
    }
  }

  /**
   * Chủ động truy vấn window.ethereum xem đã có tài khoản nào được kết nối sẵn từ trước chưa (đặc biệt hữu ích khi reload trong In-App Browser ví di động)
   */
  private async checkConnectedAccounts() {
    if (typeof window === 'undefined' || !(window as any).ethereum) return;
    try {
      const provider = new BrowserProvider((window as any).ethereum);
      const accounts = await provider.listAccounts();
      if (accounts && accounts.length > 0) {
        const address = await accounts[0].getAddress();

        // Chỉ tự động kết nối nếu tài khoản trùng khớp với tài khoản đã kết nối lần cuối
        const savedAccount = localStorage.getItem('proof_random_connected_account');
        if (savedAccount && savedAccount.toLowerCase() === address.toLowerCase()) {
          this.currentAccount.set(address);
          this.walletConnected.set(true);
          this.appKitIsConnected = false; // Đang kết nối trực tiếp qua window.ethereum
          if (typeof window !== 'undefined') {
            localStorage.setItem('proof_random_connection_type', 'metamask');
          }
          await this.updateBalanceAndStatus(address);
        }
      }
    } catch (e) {
      console.warn('[Web3] Kiểm tra kết nối sẵn qua window.ethereum thất bại:', e);
    }
  }

  /**
   * Lưu cache hiện tại vào sessionStorage
   */
  private saveCacheToSessionStorage() {
    if (typeof window === 'undefined') return;
    try {
      const chainId = this.configuredChainId().toString();
      sessionStorage.setItem(`proof_random_history_cache_${chainId}`, JSON.stringify(this._allDrawsCache[chainId] || []));
      sessionStorage.setItem(`proof_random_has_full_scan_${chainId}`, JSON.stringify(!!this._hasFullScan[chainId]));
      sessionStorage.setItem(`proof_random_session_details_${chainId}`, JSON.stringify(this._drawSessionDetailsCache[chainId] || {}));
      if (this._dashboardStatsCache[chainId]) {
        sessionStorage.setItem(`proof_random_dashboard_stats_${chainId}`, JSON.stringify(this._dashboardStatsCache[chainId]));
      }
      if (this._paginatedDrawsCache[chainId]) {
        sessionStorage.setItem(`proof_random_paginated_draws_${chainId}`, JSON.stringify(this._paginatedDrawsCache[chainId]));
      }
    } catch (e) {
      console.warn('[Web3] Không thể ghi cache vào sessionStorage:', e);
    }
  }

  /**
   * Tải cache từ sessionStorage
   */
  private loadCacheFromSessionStorage() {
    if (typeof window === 'undefined') return;
    try {
      const chainId = this.configuredChainId().toString();

      const drawsStr = sessionStorage.getItem(`proof_random_history_cache_${chainId}`);
      if (drawsStr) {
        this._allDrawsCache[chainId] = JSON.parse(drawsStr);
      } else {
        this._allDrawsCache[chainId] = [];
      }

      const fullScanStr = sessionStorage.getItem(`proof_random_has_full_scan_${chainId}`);
      if (fullScanStr) {
        this._hasFullScan[chainId] = JSON.parse(fullScanStr);
      } else {
        this._hasFullScan[chainId] = false;
      }

      const detailsStr = sessionStorage.getItem(`proof_random_session_details_${chainId}`);
      if (detailsStr) {
        this._drawSessionDetailsCache[chainId] = JSON.parse(detailsStr);
      } else {
        this._drawSessionDetailsCache[chainId] = {};
      }

      const dashboardStatsStr = sessionStorage.getItem(`proof_random_dashboard_stats_${chainId}`);
      if (dashboardStatsStr) {
        this._dashboardStatsCache[chainId] = JSON.parse(dashboardStatsStr);
      }

      const paginatedStr = sessionStorage.getItem(`proof_random_paginated_draws_${chainId}`);
      if (paginatedStr) {
        this._paginatedDrawsCache[chainId] = JSON.parse(paginatedStr);
      } else {
        this._paginatedDrawsCache[chainId] = {};
      }
    } catch (e) {
      console.warn('[Web3] Không thể đọc cache từ sessionStorage:', e);
    }
  }

  /**
   * Xóa toàn bộ bộ nhớ cache lịch sử bốc thăm của mạng hiện hành
   */
  public clearHistoryCache() {
    const chainId = this.configuredChainId().toString();
    this._allDrawsCache[chainId] = [];
    this._hasFullScan[chainId] = false;
    this._drawSessionDetailsCache[chainId] = {};
    this._paginatedDrawsCache[chainId] = {};
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(`proof_random_history_cache_${chainId}`);
        sessionStorage.removeItem(`proof_random_has_full_scan_${chainId}`);
        sessionStorage.removeItem(`proof_random_session_details_${chainId}`);
        sessionStorage.removeItem(`proof_random_paginated_draws_${chainId}`);
      } catch (e) {
        console.warn('[Web3] Lỗi khi xóa cache sessionStorage:', e);
      }
    }
  }

  /**
   * Thay đổi chế độ gas
   */
  public setGasMode(mode: 'default' | 'fast' | 'custom') {
    this.gasMode.set(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('proof_random_gas_mode', mode);
    }
  }

  /**
   * Thay đổi hệ số nhân gas tùy chỉnh
   */
  public setGasMultiplier(mult: number) {
    this.gasMultiplier.set(mult);
    if (typeof window !== 'undefined') {
      localStorage.setItem('proof_random_gas_multiplier', mult.toString());
    }
  }

  /**
   * Chuyển đổi chain ID sang đối tượng mạng tương ứng của Reown AppKit
   */
  private getAppKitNetworkByChainId(chainId: string | number): any {
    const id = chainId.toString().trim();
    switch (id) {
      case '42161': return arbitrum;
      case '421614': return arbitrumSepolia;
      default: return arbitrumSepolia;
    }
  }

  /**
   * Khởi tạo Reown AppKit cho ví WalletConnect
   */
  private initAppKit() {
    if (typeof window === 'undefined') return;

    try {
      const projectId = WEB3_CONFIG.walletConnectProjectId;
      const ethersAdapter = new EthersAdapter();
      const savedChainId = (typeof window !== 'undefined' && localStorage.getItem('proof_random_configured_chain_id')) || WEB3_CONFIG.defaultChainId;
      const defaultNet = this.getAppKitNetworkByChainId(savedChainId);

      this.modal = createAppKit({
        adapters: [ethersAdapter],
        networks: [arbitrum, arbitrumSepolia],
        defaultNetwork: defaultNet,
        allowUnsupportedChain: true,
        themeMode: 'dark',
        themeVariables: {
          '--w3m-accent': '#ff00dd',
          '--w3m-border-radius-master': '15px'
        },
        metadata: {
          name: 'ProofRandom',
          description: 'Bốc thăm ngẫu nhiên minh bạch với Chainlink VRF',
          url: window.location.origin,
          icons: [window.location.origin + '/assets/logo.png']
        },
        projectId,
        features: {
          email: true,
          socials: ['google', 'facebook', 'x', 'apple'],
          analytics: false,
          reownAuthentication: false
        },
        defaultAccountTypes: {
          eip155: 'eoa'
        }
      });

      // Lắng nghe thay đổi tài khoản từ AppKit
      this.modal.subscribeAccount(async (accountState: any) => {
        const address = accountState.address;
        const isConnected = accountState.isConnected;
        this.appKitIsConnected = isConnected || false;

        if (isConnected && address) {
          this.currentAccount.set(address);
          this.walletConnected.set(true);

          if (typeof window !== 'undefined') {
            localStorage.setItem('proof_random_connected_account', address);
            localStorage.setItem('proof_random_connection_type', 'appkit');
          }

          // Cập nhật chainId đồng bộ trực tiếp từ AppKit state trước
          const state = this.modal.getState();
          if (state && state.selectedNetworkId) {
            const selectedIdStr = state.selectedNetworkId.toString();
            const cleanChainId = selectedIdStr.includes(':') ? selectedIdStr.split(':').pop() || '' : selectedIdStr;
            this.chainId.set(cleanChainId);
          }

          // Cập nhật chi tiết số dư và chainId thực tế bất đồng bộ
          await this.updateBalanceAndStatus(address);
        } else {
          // Nếu có address nhưng isConnected = false (do ví chuyển sang mạng không hỗ trợ)
          // Chúng ta giữ kết nối ví ở chế độ Wrong Chain thay vì ngắt kết nối hoàn toàn
          if (address) {
            this.currentAccount.set(address);
            this.walletConnected.set(true);
            this.appKitIsConnected = true; // Cho phép giữ provider của AppKit để gọi lệnh switch tiếp theo
            
            if (typeof window !== 'undefined') {
              localStorage.setItem('proof_random_connected_account', address);
              localStorage.setItem('proof_random_connection_type', 'appkit');
            }
            await this.updateBalanceAndStatus(address);
            return;
          }

          // Thực sự ngắt kết nối khi không còn address và không đang trong quá trình chuyển mạng
          if (!this.isSwitchingNetwork) {
            this.walletConnected.set(false);
            this.currentAccount.set('');
            this.walletBalance.set('0.00');
            if (typeof window !== 'undefined') {
              localStorage.removeItem('proof_random_connected_account');
              localStorage.removeItem('proof_random_connection_type');
            }
          }
        }
      });

      // Lắng nghe thay đổi chain mạng lưới từ AppKit
      this.modal.subscribeNetwork((networkState: any) => {
        if (networkState) {
          let cleanChainId = '';
          if (networkState.selectedNetworkId) {
            const selectedIdStr = networkState.selectedNetworkId.toString();
            cleanChainId = selectedIdStr.includes(':') ? selectedIdStr.split(':').pop() || '' : selectedIdStr;
          } else if (networkState.caipNetworkId) {
            const caipId = networkState.caipNetworkId.toString();
            cleanChainId = caipId.split(':').pop() || '';
          }

          if (cleanChainId) {
            this.chainId.set(cleanChainId);

            const currentAddr = this.currentAccount();
            if (currentAddr) {
              this.updateBalanceAndStatus(currentAddr);
            }
          }
        }
      });

      // Đồng bộ phiên kết nối cưỡng bức sau khi load trang (Timeout 1 giây)
      setTimeout(async () => {
        try {
          if (this.modal && this.appKitIsConnected) {
            const walletProvider = this.modal.getWalletProvider();
            const state = this.modal.getState();

            if (state && state.selectedNetworkId) {
              const selectedIdStr = state.selectedNetworkId.toString();
              const cleanChainId = selectedIdStr.includes(':') ? selectedIdStr.split(':').pop() || '' : selectedIdStr;
              this.chainId.set(cleanChainId);
            }

            if (walletProvider) {
              const browserProvider = new BrowserProvider(walletProvider);
              const signer = await browserProvider.getSigner().catch(() => null);
              if (signer) {
                const address = await signer.getAddress();
                const network = await browserProvider.getNetwork();
                const chainIdStr = network.chainId.toString();

                this.currentAccount.set(address);
                this.walletConnected.set(true);
                this.appKitIsConnected = true;
                this.chainId.set(chainIdStr);

                this.updateBalanceAndStatus(address);
              }
            }
          }
        } catch (e) {
          console.warn('[Web3] Đồng bộ cưỡng bức khi reload thất bại:', e);
        }
      }, 1000);

    } catch (err) {
      console.error('[Web3] Khởi tạo AppKit thất bại:', err);
    }
  }

  /**
   * Thiết lập lắng nghe các sự kiện đổi tài khoản và mạng lưới trực tiếp từ window.ethereum
   */
  private setupEthereumListeners() {
    if (typeof window === 'undefined' || !(window as any).ethereum) return;

    const eth = (window as any).ethereum;

    eth.on('accountsChanged', (accounts: string[]) => {
      if (accounts && accounts.length > 0) {
        const account = accounts[0];
        this.currentAccount.set(account);
        this.walletConnected.set(true);
        if (typeof window !== 'undefined') {
          localStorage.setItem('proof_random_connected_account', account);
          localStorage.setItem('proof_random_connection_type', 'metamask');
        }
        this.updateBalanceAndStatus(account);
      } else {
        this.walletConnected.set(false);
        this.currentAccount.set('');
        this.walletBalance.set('0.00');
        if (typeof window !== 'undefined') {
          localStorage.removeItem('proof_random_connected_account');
          localStorage.removeItem('proof_random_connection_type');
        }
      }
    });

    eth.on('chainChanged', (chainIdHex: string) => {
      const decimalChainId = BigInt(chainIdHex).toString();
      this.chainId.set(decimalChainId);

      const account = this.currentAccount();
      if (account) {
        this.updateBalanceAndStatus(account);
      }
    });
  }

  /**
   * Cập nhật số dư ví và trạng thái
   */
  private async updateBalanceAndStatus(address: string) {
    if (typeof window === 'undefined') return;

    // Lấy chainId thực tế từ BrowserProvider (ví)
    try {
      const browserProvider = this.getBrowserProvider();
      if (browserProvider) {
        const network = await browserProvider.getNetwork();
        this.chainId.set(network.chainId.toString());
      }
    } catch (err) {
      console.warn('[Web3] Không thể lấy chainId từ BrowserProvider:', err);
    }

    // Đọc số dư bằng JsonRpcProvider công cộng để tránh nghẽn RPC ví
    try {
      const rpc = this.rpcUrl();
      const tempProvider = new JsonRpcProvider(rpc);
      const balanceBigInt = await tempProvider.getBalance(address);
      const balance = formatEther(balanceBigInt);
      this.walletBalance.set(parseFloat(balance).toFixed(4));
    } catch (err) {
      console.warn('[Web3] Không thể lấy số dư qua RPC công cộng:', err);
    }
  }

  public async connectWallet(): Promise<void> {
    if (!this.modal) {
      this.walletError.set('WalletConnect AppKit chưa được khởi tạo.');
      return;
    }

    try {
      // Phát hiện môi trường in-app browser của các app ví di động
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isInAppBrowser = typeof window !== 'undefined' && (
        (window as any).ethereum && (
          (window as any).bitkeep || 
          (window as any).ethereum.isBitKeep ||
          ((window as any).ethereum.isMetaMask && isMobile) ||
          (window as any).ethereum.isTrust ||
          navigator.userAgent.includes('Bitget') || 
          navigator.userAgent.includes('OKX') ||
          navigator.userAgent.includes('TokenPocket')
        )
      );

      if (isInAppBrowser && (window as any).ethereum) {
        try {
          const eth = (window as any).ethereum;
          const accounts = await eth.request({ method: 'eth_requestAccounts' });
          if (accounts && accounts.length > 0) {
            const address = accounts[0];
            this.currentAccount.set(address);
            this.walletConnected.set(true);
            this.appKitIsConnected = true;
            if (typeof window !== 'undefined') {
              localStorage.setItem('proof_random_connected_account', address);
              localStorage.setItem('proof_random_connection_type', 'appkit');
            }
            await this.updateBalanceAndStatus(address);
            return;
          }
        } catch (inAppErr) {
          console.warn('[Web3] Kết nối trực tiếp qua window.ethereum thất bại, fallback sang AppKit:', inAppErr);
        }
      }

      await this.modal.open();
    } catch (e: any) {
      console.error('Lỗi khi mở modal kết nối:', e);
      this.walletError.set(e.message || 'Lỗi kết nối ví.');
    }
  }

  public async openWalletModal(): Promise<void> {
    if (this.modal) {
      await this.modal.open({ view: 'Account' });
    }
  }

  public async disconnectWallet(): Promise<void> {
    if (this.modal) {
      await this.modal.disconnect();
    }
    this.walletConnected.set(false);
    this.currentAccount.set('');
    this.walletBalance.set('0.00');
    this.appKitIsConnected = false;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('proof_random_connected_account');
      localStorage.removeItem('proof_random_connection_type');
    }
  }

  /**
   * Kiểm tra và yêu cầu chuyển mạng ví đồng bộ với dApp
   */
  public async ensureCorrectNetwork(targetChainId?: string): Promise<boolean> {
    this.walletError.set('');
    this.isSwitchingNetwork = true;
    const chainIdToUse = targetChainId || this.configuredChainId();
    const chainIdHex = `0x${BigInt(chainIdToUse).toString(16)}`;

    try {
      // Ưu tiên dùng switchNetwork của AppKit để đồng bộ trạng thái an toàn
      if (this.modal) {
        try {
          const net = this.getAppKitNetworkByChainId(chainIdToUse);
          if (net) {
            await this.modal.switchNetwork(net);
            this.chainId.set(chainIdToUse);
            this.configuredChainId.set(chainIdToUse);
            if (typeof window !== 'undefined') {
              localStorage.setItem('proof_random_configured_chain_id', chainIdToUse);
            }
            const addr = this.currentAccount();
            if (addr) await this.updateBalanceAndStatus(addr);
            return true;
          }
        } catch (appKitSwitchError) {
          console.warn('Switch network via AppKit failed, attempting direct request:', appKitSwitchError);
        }
      }

      // Fallback switch trực tiếp qua provider request
      let provider: any = null;
      if (this.modal) {
        provider = this.modal.getWalletProvider();
      }
      if (!provider && typeof window !== 'undefined' && (window as any).ethereum) {
        provider = (window as any).ethereum;
      }

      if (!provider) {
        this.walletError.set('Không tìm thấy provider ví Web3!');
        return false;
      }

      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainIdHex }],
        });
        this.chainId.set(chainIdToUse);
        this.configuredChainId.set(chainIdToUse);
        if (typeof window !== 'undefined') {
          localStorage.setItem('proof_random_configured_chain_id', chainIdToUse);
        }
        const addr = this.currentAccount();
        if (addr) await this.updateBalanceAndStatus(addr);
        return true;
      } catch (directSwitchError: any) {
        console.warn('Switch network failed, attempting to add network:', directSwitchError);
        const isNetworkNotAdded = directSwitchError.code === 4902 ||
          directSwitchError.data?.originalError?.code === 4902 ||
          directSwitchError.message?.includes('4902');

        if (isNetworkNotAdded) {
          try {
            const netName = chainIdToUse === '42161' ? 'Arbitrum One' : 'Arbitrum Sepolia';
            const rpcUrl = chainIdToUse === '42161' ? 'https://arb1.arbitrum.io/rpc' : 'https://sepolia-rollup.arbitrum.io/rpc';
            const explorerUrl = chainIdToUse === '42161' ? 'https://arbiscan.io' : 'https://sepolia.arbiscan.io';

            await provider.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: chainIdHex,
                chainName: netName,
                rpcUrls: [rpcUrl],
                blockExplorerUrls: [explorerUrl],
                nativeCurrency: {
                  name: 'ETH',
                  symbol: 'ETH',
                  decimals: 18
                }
              }],
            });
            this.chainId.set(chainIdToUse);
            this.configuredChainId.set(chainIdToUse);
            if (typeof window !== 'undefined') {
              localStorage.setItem('proof_random_configured_chain_id', chainIdToUse);
            }
            const addr = this.currentAccount();
            if (addr) await this.updateBalanceAndStatus(addr);
            return true;
          } catch (addError: any) {
            console.error('Add network failed:', addError);
            this.walletError.set('Không thể tự động thêm mạng mới vào ví!');
            return false;
          }
        } else if (directSwitchError.code === 4001 || directSwitchError.message?.includes('user rejected') || directSwitchError.message?.includes('rejected')) {
          this.walletError.set('Giao dịch chuyển mạng bị hủy bởi người dùng.');
          return false;
        }
        this.walletError.set(directSwitchError.message || 'Lỗi chuyển mạng.');
        return false;
      }
    } finally {
      // Đợi 2.5 giây để ví di động ổn định kết nối lại trước khi tắt cờ chuyển mạng
      setTimeout(() => {
        this.isSwitchingNetwork = false;
      }, 2500);
    }
  }

  /**
   * Chuyển đổi mạng lưới về chain mong muốn
   */
  public async switchNetwork(targetChainId: string): Promise<void> {
    try {
      if (!this.walletConnected()) {
        this.configuredChainId.set(targetChainId);
        return;
      }

      const success = await this.ensureCorrectNetwork(targetChainId);
      if (success) {
        this.configuredChainId.set(targetChainId);
      }
    } catch (err: any) {
      console.error('[Web3] Chuyển mạng thất bại:', err);
      this.walletError.set(err.message || 'Không thể chuyển mạng.');
    }
  }

  /**
   * Khởi tạo đối tượng Smart Contract của ProofRandom
   * Hỗ trợ read-only qua RPC công cộng nếu ví chưa kết nối
   */
  public getContract(withSigner: boolean = false): Contract {
    const address = this.contractAddress();
    if (!address || address === '0x0000000000000000000000000000000000000000') {
      throw new Error('Địa chỉ Smart Contract chưa được cấu hình. Vui lòng deploy và cập nhật web3.config.ts.');
    }
    const jsonRpcProvider = new JsonRpcProvider(this.rpcUrl());
    return new Contract(address, PROOF_RANDOM_ABI, jsonRpcProvider);
  }

  /**
   * Lấy BrowserProvider tương ứng từ ví đã kết nối (ưu tiên qua AppKit provider)
   */
  public getBrowserProvider(): BrowserProvider | null {
    if (typeof window === 'undefined') return null;

    if (this.modal && this.appKitIsConnected) {
      try {
        const walletProvider = this.modal.getWalletProvider();
        if (walletProvider) {
          return new BrowserProvider(walletProvider);
        }
      } catch (e) {
        console.warn('[Web3] getWalletProvider từ AppKit lỗi:', e);
      }
      // Không fallback sang window.ethereum nếu đang dùng AppKit để tránh sai chainId
      return null;
    }

    if ((window as any).ethereum) {
      return new BrowserProvider((window as any).ethereum);
    }

    return null;
  }

  /**
   * Lấy BrowserProvider với retry – chờ tối đa 3 giây để AppKit WalletConnect provider sẵn sàng
   * Cần thiết trên Mobile: WalletConnect provider chỉ có sau khi handshake hoàn tất
   */
  private async getBrowserProviderWithRetry(maxWaitMs = 3000): Promise<BrowserProvider | null> {
    const interval = 300;
    let waited = 0;
    while (waited <= maxWaitMs) {
      const provider = this.getBrowserProvider();
      if (provider) return provider;
      await new Promise(res => setTimeout(res, interval));
      waited += interval;
    }
    return null;
  }

  /**
   * Lấy contract với signer để gửi transaction (Write)
   * ethers.js v6: getSigner(address) tránh lỗi "no such account"
   * Có retry logic để chờ AppKit WalletConnect provider sẵn sàng trên mobile
   */
  public async getContractWithSigner(): Promise<Contract> {
    const contractAddr = this.contractAddress();
    if (!contractAddr || contractAddr === '0x0000000000000000000000000000000000000000') {
      throw new Error('Địa chỉ Smart Contract chưa được cấu hình.');
    }
    if (!this.walletConnected()) {
      throw new Error('Vui lòng kết nối ví điện tử trước khi thực hiện.');
    }

    const walletAddress = this.currentAccount();
    if (!walletAddress) {
      throw new Error('Không tìm thấy địa chỉ ví. Vui lòng kết nối lại.');
    }

    // Chờ provider sẵn sàng (quan trọng với WalletConnect/mobile)
    const browserProvider = await this.getBrowserProviderWithRetry(3000);
    if (browserProvider) {
      try {
        // Cố gắng getSigner với địa chỉ cụ thể trước
        const signer = await browserProvider.getSigner(walletAddress);
        return new Contract(contractAddr, PROOF_RANDOM_ABI, signer);
      } catch (appKitErr: any) {
        console.warn('[Web3] getSigner(address) lỗi, thử getSigner() mặc định:', appKitErr);
        try {
          // Fallback: Lấy signer mặc định đầu tiên nếu provider bị lệch case địa chỉ hoặc không đồng bộ tài khoản testnet
          const defaultSigner = await browserProvider.getSigner();
          return new Contract(contractAddr, PROOF_RANDOM_ABI, defaultSigner);
        } catch (secondErr: any) {
          console.warn('[Web3] Cả 2 cách getSigner từ AppKit đều lỗi:', secondErr);
        }
      }
    }

    // Nếu đang dùng AppKit, không fallback sang window.ethereum để tránh ký trên sai provider
    if (this.appKitIsConnected) {
      throw new Error('WalletConnect provider chưa sẵn sàng hoặc bị lỗi. Vui lòng kết nối lại ví.');
    }

    // Fallback: dùng window.ethereum trực tiếp (MetaMask desktop)
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        const fallbackProvider = new BrowserProvider((window as any).ethereum);
        await fallbackProvider.send('eth_requestAccounts', []);
        const signer = await fallbackProvider.getSigner(walletAddress);
        return new Contract(contractAddr, PROOF_RANDOM_ABI, signer);
      } catch (fallbackErr: any) {
        console.warn('[Web3] Fallback getSigner thất bại:', fallbackErr);
        throw new Error('Không thể lấy Signer từ ví. Vui lòng thử lại hoặc kết nối lại ví.');
      }
    }

    throw new Error('Không tìm thấy provider ví. Vui lòng mở lại ứng dụng ví và thử lại.');
  }

  /**
   * Gửi yêu cầu bốc thăm lên smart contract
   */
  public async requestDraw(
    drawType: number,
    param1: number,
    param2: number,
    eventName: string,
    participants: string[]
  ): Promise<string> {
    if (!this.walletConnected()) {
      throw new Error('Vui lòng kết nối ví trước khi thực hiện.');
    }

    // Đảm bảo ví ở đúng mạng cấu hình trước khi gửi giao dịch
    const hasCorrectNetwork = await this.ensureCorrectNetwork();
    if (!hasCorrectNetwork) {
      throw new Error(this.walletError() || 'Vui lòng chuyển mạng ví sang đúng mạng cấu hình!');
    }

    try {
      let tx: any;
      const overrides: any = {};

      if (this.gasMode() !== 'default') {
        const mult = this.gasMode() === 'fast' ? 2.0 : this.gasMultiplier();
        const multBig = BigInt(Math.round(mult * 100));

        // 1. Ước tính gasLimit bằng contract read-only
        try {
          const readOnlyContract = this.getContract(false);
          const estimatedGas = await readOnlyContract['requestDraw'].estimateGas(
            drawType,
            param1,
            param2,
            eventName,
            participants,
            { from: this.currentAccount() }
          );
          overrides.gasLimit = (estimatedGas * multBig) / 100n;
        } catch (e) {
          console.warn('[Web3] Không thể ước tính gasLimit qua RPC công cộng:', e);
        }

        // 2. Lấy dữ liệu phí gas và nhân thêm hệ số
        try {
          const publicProvider = new JsonRpcProvider(this.rpcUrl());
          const feeData = await publicProvider.getFeeData();

          if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
            overrides.maxFeePerGas = (feeData.maxFeePerGas * multBig) / 100n;
            overrides.maxPriorityFeePerGas = (feeData.maxPriorityFeePerGas * multBig) / 100n;
          } else if (feeData.gasPrice) {
            overrides.gasPrice = (feeData.gasPrice * multBig) / 100n;
          }
        } catch (e) {
          console.warn('[Web3] Không thể lấy fee data từ RPC công cộng:', e);
        }
      }

      try {
        const contract = await this.getContractWithSigner();
        tx = await contract['requestDraw'](drawType, param1, param2, eventName, participants, overrides);
      } catch (signerErr: any) {
        console.warn('[Web3] Lỗi getContractWithSigner, thử gửi raw tx qua provider:', signerErr);
        const walletProvider = this.modal?.getWalletProvider();
        if (!walletProvider) {
          throw signerErr; // Ném lỗi cũ nếu không có raw provider (AppKit không sẵn sàng)
        }

        const iface = new Interface(PROOF_RANDOM_ABI);
        const data = iface.encodeFunctionData('requestDraw', [drawType, param1, param2, eventName, participants]);

        const txParam: any = {
          from: this.currentAccount(),
          to: this.contractAddress(),
          data: data,
          value: '0x0'
        };
        if (overrides.gasLimit) txParam.gas = '0x' + overrides.gasLimit.toString(16);
        if (overrides.maxFeePerGas) txParam.maxFeePerGas = '0x' + overrides.maxFeePerGas.toString(16);
        if (overrides.maxPriorityFeePerGas) txParam.maxPriorityFeePerGas = '0x' + overrides.maxPriorityFeePerGas.toString(16);
        if (overrides.gasPrice) txParam.gasPrice = '0x' + overrides.gasPrice.toString(16);

        let txHash: string;
        try {
          txHash = await walletProvider.request({
            method: 'eth_sendTransaction',
            params: [txParam]
          });
        } catch (rawErr: any) {
          const errMsg = rawErr.message || '';
          if (errMsg.includes('Missing or invalid') && errMsg.includes('chainId')) {
            throw new Error('Ví chưa cấp quyền cho mạng Testnet này! Vui lòng NGẮT KẾT NỐI ví trên dApp, mở app chuyển mạng sang Arbitrum Sepolia, sau đó kết nối lại!');
          }
          throw rawErr;
        }

        // Chờ giao dịch hoàn tất bằng JsonRpcProvider công cộng (Timeout 2 phút)
        const rpcProvider = new JsonRpcProvider(this.rpcUrl());
        const receipt = await rpcProvider.waitForTransaction(txHash, 1, 120000);
        if (!receipt) throw new Error('Không nhận được biên lai giao dịch.');

        tx = { wait: () => Promise.resolve(receipt) };
      }

      const receipt = await tx.wait();

      // Tìm requestId từ Event logs
      let requestId = '';
      const iface = new Interface(PROOF_RANDOM_ABI);
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
          if (parsed && parsed.name === 'DrawRequested') {
            requestId = parsed.args['requestId'].toString();
            break;
          }
        } catch (e) {
          // Log không khớp ABI
        }
      }

      return requestId || receipt.hash;
    } catch (err: any) {
      console.error('[Web3] Gửi yêu cầu bốc thăm thất bại:', err);
      let cleanMsg = err.message || 'Lỗi giao dịch';
      if (err.data && err.data.message) {
        cleanMsg = err.data.message;
      } else if (err.reason) {
        cleanMsg = err.reason;
      }
      throw new Error(cleanMsg);
    }
  }

  /**
   * Tạo instance contract cho một chainId cụ thể (read-only)
   */
  public getContractForChain(chainId: string): Contract | null {
    const address = WEB3_CONFIG.contracts[chainId];
    if (!address || address === '0x0000000000000000000000000000000000000000') {
      return null;
    }

    const rpcUrl = WEB3_CONFIG.rpcs[chainId] || WEB3_CONFIG.rpcs[WEB3_CONFIG.defaultChainId];
    const jsonRpcProvider = new JsonRpcProvider(rpcUrl);
    return new Contract(address, PROOF_RANDOM_ABI, jsonRpcProvider);
  }

  /**
   * Tự động dò tìm xem query (RequestID hoặc Tx Hash) thuộc về mạng lưới nào
   */
  public async detectAndSwitchChain(query: string): Promise<string | null> {
    if (!query) return null;
    const cleanQuery = query.trim();
    const chains = Object.keys(WEB3_CONFIG.contracts);

    if (cleanQuery.startsWith('0x') && cleanQuery.length === 66) {
      for (const cid of chains) {
        try {
          const rpcUrl = WEB3_CONFIG.rpcs[cid];
          if (!rpcUrl) continue;
          const provider = new JsonRpcProvider(rpcUrl);
          const tx = await provider.getTransaction(cleanQuery);
          if (tx) {
            this.configuredChainId.set(cid);
            return cid;
          }
        } catch (e) {
          // Thử tiếp
        }
      }
    } else {
      for (const cid of chains) {
        try {
          const contract = this.getContractForChain(cid);
          if (!contract) continue;

          const session = await contract['sessions'](cleanQuery);
          if (session && session.creator !== '0x0000000000000000000000000000000000000000') {
            this.configuredChainId.set(cid);
            return cid;
          }
        } catch (e) {
          // Thử tiếp
        }
      }
    }
    return null;
  }

  /**
   * Đọc dữ liệu thô của 1 phiên bốc thăm
   */
  public async getDrawSession(requestId: string): Promise<any> {
    try {
      const contract = this.getContract(false);
      const session = await contract['sessions'](requestId);
      if (session.creator === '0x0000000000000000000000000000000000000000') {
        return null;
      }
      const parsed = this.parseEventNameAndSkin(session.eventName);
      return {
        requestId: session.requestId.toString(),
        creator: session.creator,
        drawType: Number(session.drawType),
        param1: Number(session.param1),
        param2: Number(session.param2),
        randomWord: session.randomWord.toString(),
        timestamp: Number(session.timestamp),
        eventName: parsed.eventName,
        skin: parsed.skin,
        result: session.result,
        fulfilled: session.fulfilled
      };
    } catch (err) {
      console.error('[Web3] Lấy session lỗi:', err);
      return null;
    }
  }

  /**
   * Quét sự kiện DrawCreated để khôi phục lịch sử bốc thăm
   */
  public async getAllDrawSessionsFromEvents(forceRefresh = false): Promise<any[]> {
    try {
      const chainId = this.configuredChainId().toString();

      if (!this._allDrawsCache[chainId]) {
        this._allDrawsCache[chainId] = [];
        this._hasFullScan[chainId] = false;
        this._drawSessionDetailsCache[chainId] = {};
      }

      if (this._allDrawsCache[chainId].length === 0 && !this._hasFullScan[chainId]) {
        this.loadCacheFromSessionStorage();
      }

      if (this._hasFullScan[chainId] && !forceRefresh) {
        return this._allDrawsCache[chainId];
      }

      const contract = this.getContract(false);
      const filter = contract['filters']['DrawCreated']();
      const events = await contract.queryFilter(filter, 0, 'latest');

      const draws: any[] = [];
      for (const event of events) {
        const args = (event as any).args;
        const parsed = this.parseEventNameAndSkin(args.eventName);
        const reqIdStr = args.requestId.toString();
        const cachedDetail = this._drawSessionDetailsCache[chainId]?.[reqIdStr];

        draws.push({
          requestId: reqIdStr,
          creator: args.creator,
          eventName: parsed.eventName,
          skin: parsed.skin,
          drawType: Number(args.drawType),
          participants: args.participants,
          param1: Number(args.param1),
          param2: Number(args.param2),
          txHash: event.transactionHash,
          blockNumber: event.blockNumber,
          fulfilled: cachedDetail ? cachedDetail.fulfilled : false,
          randomWord: cachedDetail ? cachedDetail.randomWord : '0',
          result: cachedDetail ? cachedDetail.result : []
        });
      }

      const reversedDraws = draws.reverse();
      this._allDrawsCache[chainId] = reversedDraws;
      this._hasFullScan[chainId] = true;

      for (const draw of reversedDraws) {
        const reqId = draw.requestId;
        if (!this._drawSessionDetailsCache[chainId][reqId]) {
          this._drawSessionDetailsCache[chainId][reqId] = { ...draw };
        }
      }

      this.saveCacheToSessionStorage();
      return reversedDraws;
    } catch (err) {
      console.error('[Web3] Lấy danh sách draw từ event logs lỗi:', err);
      const chainId = this.configuredChainId().toString();
      return this._allDrawsCache[chainId] || [];
    }
  }

  /**
   * Lấy chi tiết phiên bốc thăm bao gồm cả mảng người tham gia và Tx Hash
   */
  public async getDrawSessionDetails(requestId: string, forceRefresh = false): Promise<any> {
    try {
      const chainId = this.configuredChainId().toString();
      if (!this._drawSessionDetailsCache[chainId]) {
        this._drawSessionDetailsCache[chainId] = {};
      }

      if (Object.keys(this._drawSessionDetailsCache[chainId]).length === 0) {
        this.loadCacheFromSessionStorage();
      }

      const cached = this._drawSessionDetailsCache[chainId][requestId];
      if (cached && cached.fulfilled && !forceRefresh) {
        return cached;
      }

      const sessionData = await this.getDrawSession(requestId);
      if (!sessionData) return null;

      const contract = this.getContract(false);
      const filter = contract['filters']['DrawCreated'](requestId);
      const events = await contract.queryFilter(filter, 0, 'latest');

      let participants: string[] = [];
      let txHash = '';
      let blockNumber = 0;

      if (events.length > 0) {
        const ev = events[0] as any;
        participants = ev.args.participants;
        txHash = ev.transactionHash;
        blockNumber = ev.blockNumber;
      }

      const detailedData = {
        ...sessionData,
        participants,
        txHash,
        blockNumber
      };

      this._drawSessionDetailsCache[chainId][requestId] = detailedData;

      if (this._allDrawsCache[chainId]) {
        const idx = this._allDrawsCache[chainId].findIndex(d => d.requestId === requestId);
        if (idx !== -1) {
          this._allDrawsCache[chainId][idx] = {
            ...this._allDrawsCache[chainId][idx],
            fulfilled: detailedData.fulfilled,
            randomWord: detailedData.randomWord,
            result: detailedData.result
          };
        }
      }

      this.saveCacheToSessionStorage();
      return detailedData;
    } catch (err) {
      console.error('[Web3] Lấy chi tiết bốc thăm lỗi:', err);
      const chainId = this.configuredChainId().toString();
      const cached = this._drawSessionDetailsCache[chainId]?.[requestId];
      if (cached) {
        return cached;
      }
      return null;
    }
  }

  /**
   * Lấy danh sách các phiên bốc thăm phân trang trực tiếp từ Contract State (có sử dụng Cache)
   * Giúp dApp tải cực nhanh và không bị giới hạn block range của RPC Node khi dữ liệu lớn
   */
  public async getDrawSessionsPaginated(page: number, limit: number, forceRefresh = false): Promise<{ draws: any[], total: number }> {
    try {
      const chainId = this.configuredChainId().toString();
      if (!this._paginatedDrawsCache[chainId]) {
        this._paginatedDrawsCache[chainId] = {};
      }

      const cache = this._paginatedDrawsCache[chainId][page];
      const CACHE_DURATION = 180000; // 3 phút

      if (cache && !forceRefresh && (Date.now() - cache.timestamp < CACHE_DURATION)) {
        return { draws: cache.draws, total: cache.total };
      }

      const contract = this.getContract(false);
      const totalBig = await contract['getSessionsCount']();
      const total = Number(totalBig);

      if (total === 0) {
        return { draws: [], total: 0 };
      }

      const draws: any[] = [];
      const startIndex = total - 1 - (page - 1) * limit;
      const endIndex = Math.max(0, startIndex - limit + 1);

      // Tạo danh sách index cần đọc
      const indices: number[] = [];
      for (let i = startIndex; i >= endIndex; i--) {
        indices.push(i);
      }

      // Đọc song song các requestId
      const idPromises = indices.map(idx => contract['requestIds'](idx));
      const requestIdsBig = await Promise.all(idPromises);

      // Đọc chi tiết từng phiên song song
      const detailPromises = requestIdsBig.map(reqId => this.getDrawSessionDetails(reqId.toString()));
      const details = await Promise.all(detailPromises);

      // Lọc các phiên hợp lệ
      for (const d of details) {
        if (d) {
          draws.push(d);
        }
      }

      // Lưu cache
      this._paginatedDrawsCache[chainId][page] = {
        draws,
        total,
        timestamp: Date.now()
      };
      this.saveCacheToSessionStorage();

      return { draws, total };
    } catch (err) {
      console.error('[Web3] Lấy danh sách phân trang lỗi:', err);
      return { draws: [], total: 0 };
    }
  }

  /**
   * Tính toán kết quả bốc thăm deterministic trên Client-side dựa trên randomWord (giống hệt Smart Contract)
   */
  public calculateResultClientSide(
    drawType: number,
    param1: number,
    param2: number,
    randomWord: string,
    participants: string[]
  ): any {
    if (!randomWord || randomWord === '0') return null;

    const seed = BigInt(randomWord);

    if (drawType === 1) {
      const min = BigInt(param1);
      const max = BigInt(param2);
      const resultVal = min + (seed % (max - min + 1n));
      return {
        result: resultVal.toString(),
        winners: [resultVal.toString()]
      };
    }
    else if (drawType === 2) {
      const idx = Number(seed % BigInt(param1));
      const winnerName = participants && participants[idx] ? participants[idx] : `Index: ${idx}`;
      return {
        result: idx.toString(),
        winners: [winnerName]
      };
    }
    else if (drawType === 3) {
      const total = param1;
      const k = param2;
      const winners: string[] = [];
      const winnerIndices: number[] = [];

      let tempRandom = seed;

      for (let i = 0; i < k; i++) {
        const hashHex = this.solidityKeccak256(['uint256', 'uint256'], [tempRandom.toString(), i.toString()]);
        tempRandom = BigInt(hashHex);
        let candidate = Number(tempRandom % BigInt(total));

        let duplicate = winnerIndices.includes(candidate);
        if (duplicate) {
          let attempt = 0;
          while (duplicate && attempt < 30) {
            const retryHash = this.solidityKeccak256(['uint256', 'uint256'], [tempRandom.toString(), (attempt + 100).toString()]);
            tempRandom = BigInt(retryHash);
            candidate = Number(tempRandom % BigInt(total));
            duplicate = winnerIndices.includes(candidate);
            attempt++;
          }
        }
        winnerIndices.push(candidate);
        const name = participants && participants[candidate] ? participants[candidate] : `Index: ${candidate}`;
        winners.push(name);
      }

      return {
        result: winnerIndices.join(','),
        winners: winners
      };
    }
    else if (drawType === 4) {
      const res = seed % 2n === 0n ? 'Heads' : 'Tails';
      return { result: res, winners: [res] };
    }
    else if (drawType === 5) {
      const sides = BigInt(param1);
      const resVal = 1n + (seed % sides);
      return { result: resVal.toString(), winners: [`Mặt ${resVal}`] };
    }
    else if (drawType === 6) {
      const res = seed % 2n === 0n ? 'Even' : 'Odd';
      return { result: res, winners: [res] };
    }
    else if (drawType === 7) {
      const hashHex = this.solidityKeccak256(['uint256'], [seed.toString()]);
      const byte31 = hashHex.substring(hashHex.length - 2);
      const byte30 = hashHex.substring(hashHex.length - 4, hashHex.length - 2);
      const byte29 = hashHex.substring(hashHex.length - 6, hashHex.length - 4);
      const color = ('#' + byte31 + byte30 + byte29).toUpperCase();
      return { result: color, winners: [color] };
    }
    else if (drawType === 8) {
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const idx = Number(seed % 26n);
      const letter = letters[idx];
      return { result: letter, winners: [letter] };
    }
    else if (drawType === 9) {
      const total = param1;
      const numTeams = param2;
      const teams: { name: string; members: string[] }[] = [];

      for (let t = 0; t < numTeams; t++) {
        teams.push({ name: `Team ${String.fromCharCode(65 + t)}`, members: [] });
      }

      const indices = Array.from({ length: total }, (_, i) => i);
      let tempRandom = seed;

      for (let i = total - 1; i > 0; i--) {
        const hashHex = this.solidityKeccak256(['uint256', 'uint256'], [tempRandom.toString(), i.toString()]);
        tempRandom = BigInt(hashHex);
        const swapIdx = Number(tempRandom % BigInt(i + 1));

        const temp = indices[i];
        indices[i] = indices[swapIdx];
        indices[swapIdx] = temp;
      }

      for (let i = 0; i < total; i++) {
        const memberIdx = indices[i];
        const memberName = participants && participants[memberIdx] ? participants[memberIdx] : `Index: ${memberIdx}`;
        const teamIdx = i % numTeams;
        teams[teamIdx].members.push(memberName);
      }

      return {
        result: 'Teams Assigned',
        teams: teams
      };
    }

    return null;
  }

  /**
   * Lấy số dư LINK trong Chainlink VRF Subscription
   */
  public async getLinkSubscriptionBalance(): Promise<{ balance: string; subscriptionId: string } | null> {
    try {
      const rpcProvider = new JsonRpcProvider(this.rpcUrl());
      const proofContract = new Contract(this.contractAddress(), PROOF_RANDOM_ABI, rpcProvider);

      const [subId, coordinatorAddress]: [bigint, string] = await Promise.all([
        proofContract['s_subscriptionId'](),
        proofContract['s_vrfCoordinator']()
      ]);

      if (!subId || subId === 0n) return null;
      if (!coordinatorAddress || coordinatorAddress === '0x0000000000000000000000000000000000000000') return null;

      const coordinator = new Contract(coordinatorAddress, VRF_COORDINATOR_ABI, rpcProvider);
      const subInfo = await coordinator['getSubscription'](subId);

      const balanceJuels: bigint = subInfo.balance ?? subInfo[0];
      const balanceLink = parseFloat(formatEther(balanceJuels)).toFixed(4);
      return { balance: balanceLink, subscriptionId: subId.toString() };
    } catch (err) {
      console.error('[Web3] Lấy số dư LINK subscription lỗi:', err);
      return null;
    }
  }

  /**
   * Giải mã eventName và bóc tách tiền tố [Skin:xxx] nếu có
   */
  public parseEventNameAndSkin(rawEventName: string): { eventName: string; skin: string } {
    if (!rawEventName) return { eventName: '', skin: '' };
    const match = rawEventName.match(/^\[Skin:([^\]]+)\]\s*(.*)/);
    if (match) {
      return {
        skin: match[1],
        eventName: match[2]
      };
    }
    return {
      skin: '',
      eventName: rawEventName
    };
  }

  /**
   * Truy vấn và cache các số liệu thống kê cho Dashboard
   */
  public async getDashboardStats(forceRefresh = false): Promise<DashboardStats | null> {
    try {
      const chainId = this.configuredChainId().toString();
      const cache = this._dashboardStatsCache[chainId];
      const CACHE_DURATION = 180000;

      if (cache && !forceRefresh && (Date.now() - cache.timestamp < CACHE_DURATION)) {
        return cache.stats;
      }

      const contract = this.getContract(false);
      const totalSessionsBig = await contract['getSessionsCount']();
      const totalSessionsCount = Number(totalSessionsBig);

      let draws = await this.getAllDrawSessionsFromEvents(forceRefresh);

      if (draws.length < totalSessionsCount) {
        draws = await this.getAllDrawSessionsFromEvents(true);
      }

      const recent = [];
      const limit = Math.min(draws.length, 5);

      for (let i = 0; i < limit; i++) {
        const d = draws[i];
        const status = await this.getDrawSession(d.requestId);
        recent.push({
          ...d,
          fulfilled: status ? status.fulfilled : false,
          result: status ? status.result : '',
          timestamp: status ? status.timestamp : 0
        });
      }

      let completedCount = 0;
      try {
        const filter = contract['filters']['DrawFulfilled']();
        const fulfilledEvents = await contract.queryFilter(filter, 0, 'latest');
        completedCount = fulfilledEvents.length;
      } catch (err) {
        completedCount = recent.filter(r => r.fulfilled).length;
      }

      if (completedCount > totalSessionsCount) {
        completedCount = totalSessionsCount;
      }

      let balanceStr = 'N/A';
      let subscriptionIdStr = '';
      const linkInfo = await this.getLinkSubscriptionBalance();
      if (linkInfo) {
        balanceStr = linkInfo.balance;
        subscriptionIdStr = linkInfo.subscriptionId;
      }

      const stats: DashboardStats = {
        totalSessions: totalSessionsCount,
        totalDraws: completedCount,
        linkBalance: balanceStr,
        subscriptionId: subscriptionIdStr,
        recentDraws: recent
      };

      this._dashboardStatsCache[chainId] = {
        stats,
        timestamp: Date.now()
      };
      this.saveCacheToSessionStorage();

      return stats;
    } catch (err) {
      console.error('[Web3] Tải dashboard stats lỗi:', err);
      const chainId = this.configuredChainId().toString();
      return this._dashboardStatsCache[chainId]?.stats || null;
    }
  }

  public clearDashboardStatsCache(chainId?: string) {
    if (chainId) {
      delete this._dashboardStatsCache[chainId];
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(`proof_random_dashboard_stats_${chainId}`);
      }
    } else {
      this._dashboardStatsCache = {};
      if (typeof window !== 'undefined') {
        const keys = Object.keys(sessionStorage);
        for (const key of keys) {
          if (key.startsWith('proof_random_dashboard_stats_')) {
            sessionStorage.removeItem(key);
          }
        }
      }
    }
  }

  public hasPaginatedDrawsCache(page: number, limit: number): boolean {
    const chainId = this.configuredChainId().toString();
    const cache = this._paginatedDrawsCache[chainId]?.[page];
    const CACHE_DURATION = 180000;
    return !!(cache && (Date.now() - cache.timestamp < CACHE_DURATION) && cache.draws.length > 0);
  }

  public solidityKeccak256(types: string[], values: any[]): string {
    return solidityPackedKeccak256(types, values);
  }
}
