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
    this.initAppKit();
    this.setupEthereumListeners();

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
   * Khởi tạo Reown AppKit cho ví WalletConnect giống chuẩn của cafe-blockchain
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

          // Cập nhật chainId đồng bộ trực tiếp từ AppKit state trước
          const state = this.modal.getState();
          if (state && state.selectedNetworkId) {
            const selectedIdStr = state.selectedNetworkId.toString();
            const cleanChainId = selectedIdStr.includes(':') ? selectedIdStr.split(':').pop() || '' : selectedIdStr;
            this.chainId.set(cleanChainId);
            if (cleanChainId === '42161' || cleanChainId === '421614') {
              this.configuredChainId.set(cleanChainId);
            }
          }

          // Cập nhật chi tiết số dư và chainId thực tế bất đồng bộ
          await this.updateBalanceAndStatus(address);
        } else {
          this.walletConnected.set(false);
          this.currentAccount.set('');
          this.walletBalance.set('0.00');
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
            if (cleanChainId === '42161' || cleanChainId === '421614') {
              this.configuredChainId.set(cleanChainId);
            }

            const currentAddr = this.currentAccount();
            if (currentAddr) {
              this.updateBalanceAndStatus(currentAddr);
            }
          }
        }
      });

      // Đồng bộ phiên kết nối cưỡng bức sau khi load trang (Timeout 1 giây tương tự michic/cafe-blockchain)
      setTimeout(async () => {
        try {
          if (this.modal) {
            const walletProvider = this.modal.getWalletProvider();
            const state = this.modal.getState();
            
            if (state && state.selectedNetworkId) {
              const selectedIdStr = state.selectedNetworkId.toString();
              const cleanChainId = selectedIdStr.includes(':') ? selectedIdStr.split(':').pop() || '' : selectedIdStr;
              this.chainId.set(cleanChainId);
              if (cleanChainId === '42161' || cleanChainId === '421614') {
                this.configuredChainId.set(cleanChainId);
              }
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
                
                if (chainIdStr === '42161' || chainIdStr === '421614') {
                  this.configuredChainId.set(chainIdStr);
                }
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
   * Kế thừa cấu trúc chuẩn của cafe-blockchain
   */
  private setupEthereumListeners() {
    if (typeof window === 'undefined' || !(window as any).ethereum) return;

    const eth = (window as any).ethereum;

    eth.on('accountsChanged', (accounts: string[]) => {
      if (accounts && accounts.length > 0) {
        const account = accounts[0];
        this.currentAccount.set(account);
        this.walletConnected.set(true);
        this.updateBalanceAndStatus(account);
      } else {
        this.walletConnected.set(false);
        this.currentAccount.set('');
        this.walletBalance.set('0.00');
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
    try {
      if (typeof window === 'undefined') return;

      // Đọc số dư bằng JsonRpcProvider công cộng để tránh nghẽn RPC ví
      const rpc = this.rpcUrl();
      const tempProvider = new JsonRpcProvider(rpc);
      const balanceBigInt = await tempProvider.getBalance(address);
      const balance = formatEther(balanceBigInt);
      this.walletBalance.set(parseFloat(balance).toFixed(4));

      // Lấy chainId thực tế từ provider
      const browserProvider = this.getBrowserProvider();
      if (browserProvider) {
        const network = await browserProvider.getNetwork();
        this.chainId.set(network.chainId.toString());
      }
    } catch (err) {
      console.warn('[Web3] Cập nhật số dư và trạng thái lỗi:', err);
    }
  }

  public async connectWallet(): Promise<void> {
    if (this.modal) {
      await this.modal.open();
    } else {
      this.walletError.set('WalletConnect AppKit chưa được khởi tạo.');
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
  }

  /**
   * Kiểm tra và yêu cầu chuyển mạng ví đồng bộ với dApp
   */
  public async ensureCorrectNetwork(targetChainId?: string): Promise<boolean> {
    this.walletError.set('');
    const chainIdToUse = targetChainId || this.configuredChainId();
    const chainIdHex = `0x${BigInt(chainIdToUse).toString(16)}`;

    // Ưu tiên dùng switchNetwork của AppKit để đồng bộ trạng thái an toàn
    if (this.modal && this.appKitIsConnected) {
      try {
        const net = this.getAppKitNetworkByChainId(chainIdToUse);
        if (net) {
          await this.modal.switchNetwork(net);
          this.chainId.set(chainIdToUse);
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
    if (this.modal && this.appKitIsConnected) {
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
   * Lấy BrowserProvider tương ứng từ ví đã kết nối (ưu tiên qua AppKit provider giống cafe-blockchain)
   */
  public getBrowserProvider(): BrowserProvider | null {
    if (typeof window === 'undefined') return null;

    if (this.modal && this.appKitIsConnected) {
      const walletProvider = this.modal.getWalletProvider();
      if (walletProvider) {
        return new BrowserProvider(walletProvider);
      }
    }

    if ((window as any).ethereum) {
      return new BrowserProvider((window as any).ethereum);
    }

    return null;
  }

  /**
   * Lấy contract với signer để gửi transaction (Write)
   * ethers.js v6: getSigner() là async, phải await
   */
  public async getContractWithSigner(): Promise<Contract> {
    const address = this.contractAddress();
    if (!address || address === '0x0000000000000000000000000000000000000000') {
      throw new Error('Địa chỉ Smart Contract chưa được cấu hình.');
    }
    if (!this.walletConnected()) {
      throw new Error('Vui lòng kết nối ví điện tử trước khi thực hiện.');
    }

    const browserProvider = this.getBrowserProvider();
    if (!browserProvider) {
      throw new Error('Không thể tìm thấy provider của ví.');
    }

    try {
      await browserProvider.send("eth_requestAccounts", []);
    } catch (reqAccErr) {
      console.warn('[Web3] Cảnh báo eth_requestAccounts:', reqAccErr);
    }

    let signer: any;
    try {
      signer = await browserProvider.getSigner();
    } catch (signerErr: any) {
      console.warn('[Web3] getSigner từ primary provider lỗi, thử fallback window.ethereum:', signerErr);
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        try {
          const fallbackProvider = new BrowserProvider((window as any).ethereum);
          await fallbackProvider.send("eth_requestAccounts", []);
          signer = await fallbackProvider.getSigner();
        } catch (fallbackErr) {
          throw signerErr;
        }
      } else {
        throw signerErr;
      }
    }

    return new Contract(address, PROOF_RANDOM_ABI, signer);
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
      const contract = await this.getContractWithSigner();
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

      const tx = await contract['requestDraw'](drawType, param1, param2, eventName, participants, overrides);
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

  /**
   * Xóa bộ nhớ cache dashboard stats
   */
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

  /**
   * Kiểm tra xem đã có cache phân trang hợp lệ
   */
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
