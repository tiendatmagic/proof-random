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
  private modal!: any;

  // Signals quản lý trạng thái ví (Chuẩn theo angular-web3-wallet)
  public readonly address = signal<string | null>(null);
  public readonly chainId = signal<number | null>(null);
  public readonly isConnected = signal<boolean>(false);
  public readonly balance = signal<string>('0.0000');
  public readonly networkName = signal<string>('Unknown Network');
  public readonly isWrongChain = signal<boolean>(false);
  public readonly txSpeed = signal<'default' | 'fast' | 'custom'>('default');
  public readonly gasMultiplier = signal<number>(2);
  public readonly showWrongChainModal = signal<boolean>(false);

  // --- ALIASES TƯƠNG THÍCH NGƯỢC ---
  public readonly walletConnected = computed(() => this.isConnected());
  public readonly currentAccount = computed(() => this.address() || '');
  public readonly walletBalance = computed(() => this.balance());
  public readonly isInitializing = signal<boolean>(false);
  public readonly walletError = signal<string>('');

  // Chế độ gas tương thích ngược
  public readonly gasMode = this.txSpeed;

  // Cấu hình mạng dApp mong muốn (Đồng bộ với chainId thực tế)
  public readonly configuredChainId = signal<string>(
    (typeof window !== 'undefined' && localStorage.getItem('proof_random_configured_chain_id')) || WEB3_CONFIG.defaultChainId
  );

  // Mạng được hỗ trợ (cấu hình động RPC & Explorer)
  public readonly supportedChains = [arbitrum, arbitrumSepolia].map(chain => {
    const idStr = chain.id.toString();
    const rpc = WEB3_CONFIG.rpcs[idStr];
    const explorer = WEB3_CONFIG.explorers[idStr];
    return {
      ...chain,
      rpcUrls: rpc ? { ...chain.rpcUrls, default: { http: [rpc] } } : chain.rpcUrls,
      blockExplorers: explorer ? { ...chain.blockExplorers, default: { name: chain.name, url: explorer } } : chain.blockExplorers
    };
  });

  public readonly activeNetwork = computed(() => {
    const id = this.configuredChainId();
    return id === '42161' ? 'arbitrum' : 'arbitrumSepolia';
  });

  public readonly contractAddress = computed(() => {
    const id = this.configuredChainId();
    return WEB3_CONFIG.contracts[id] || '0x0000000000000000000000000000000000000000';
  });

  public readonly rpcUrl = computed(() => {
    const id = this.configuredChainId();
    return WEB3_CONFIG.rpcs[id] || WEB3_CONFIG.rpcs[WEB3_CONFIG.defaultChainId];
  });

  public readonly explorerUrl = computed(() => {
    const id = this.configuredChainId();
    return WEB3_CONFIG.explorers[id] || WEB3_CONFIG.explorers[WEB3_CONFIG.defaultChainId];
  });

  public readonly shortAddress = computed(() => {
    const addr = this.address();
    if (!addr) return '';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  });

  public readonly networkSymbol = computed(() => 'ETH');

  // Cache lưu trữ lịch sử bốc thăm
  private _allDrawsCache: Record<string, any[]> = {};
  private _hasFullScan: Record<string, boolean> = {};
  private _drawSessionDetailsCache: Record<string, Record<string, any>> = {};
  private _dashboardStatsCache: Record<string, { stats: DashboardStats; timestamp: number }> = {};
  private _paginatedDrawsCache: Record<string, Record<number, { draws: any[], total: number, timestamp: number }>> = {};

  public get historyCacheDraws(): any[] {
    const id = this.configuredChainId().toString();
    return this._allDrawsCache[id] || [];
  }

  public get historyHasFullScan(): boolean {
    const id = this.configuredChainId().toString();
    return !!this._hasFullScan[id];
  }

  constructor() {
    this.loadGasSettings();
    this.initAppKit();

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
      const currentChain = this.walletConnected() ? this.chainId()?.toString() : this.configuredChainId();
      if (currentChain === '42161') {
        this.txSpeed.set('default');
      } else {
        const savedMode = localStorage.getItem('proof_random_gas_mode') as 'default' | 'fast' | 'custom' | null;
        this.txSpeed.set(savedMode || 'fast');
      }
    }, { allowSignalWrites: true });
  }

  /**
   * Tự động dọn dẹp dữ liệu kẹt trong IndexedDB & LocalStorage nếu chưa đăng nhập (Self-Healing)
   */
  private async clearWalletConnectStorage() {
    if (typeof window === 'undefined') return;

    try {
      if ('indexedDB' in window) {
        const dbs = (await indexedDB.databases?.()) || [];
        for (const db of dbs) {
          if (db.name && (db.name.includes('WALLET_CONNECT') || db.name.includes('walletconnect') || db.name.includes('reown') || db.name.includes('appkit'))) {
            indexedDB.deleteDatabase(db.name);
          }
        }
      }
    } catch (e) {
      console.warn('[Web3] Lỗi khi dọn dẹp IndexedDB:', e);
    }

    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('wc@2') || key.startsWith('@w3m') || key.startsWith('@appkit'))) {
          if (key.includes('proposal') || key.includes('request') || key.includes('pending')) {
            keysToRemove.push(key);
          }
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (e) {}
  }

  /**
   * Khởi tạo Reown AppKit cho ví (Chuẩn 100% theo angular-web3-wallet)
   */
  private async initAppKit() {
    if (typeof window === 'undefined') return;

    const projectId = WEB3_CONFIG.walletConnectProjectId;
    if (!projectId) {
      console.warn('[Web3] walletConnectProjectId is missing.');
      return;
    }

    // Nếu chưa đăng nhập, tự động dọn rác session/proposal treo cũ trong storage
    if (!this.isConnected()) {
      await this.clearWalletConnectStorage();
    }

    this.modal = createAppKit({
      adapters: [new EthersAdapter()],
      networks: this.supportedChains as any,
      defaultNetwork: arbitrum as any,
      allowUnsupportedChain: true,
      metadata: {
        name: 'ProofRandom',
        description: 'Bốc thăm ngẫu nhiên minh bạch với Chainlink VRF',
        url: window.location.origin,
        icons: [window.location.origin + '/assets/logo.png']
      },
      projectId,
      themeMode: 'dark',
      themeVariables: {
        '--w3m-accent': '#ff00dd',
        '--w3m-border-radius-master': '15px'
      },
      features: {
        email: true,
        socials: ['google', 'facebook', 'x', 'apple'],
        analytics: false,
        reownAuthentication: false
      },
      enableCoinbase: false
    } as any);

    // Lắng nghe thay đổi tài khoản
    this.modal.subscribeAccount(async (accountState: any) => {
      this.address.set(accountState.address || null);
      this.isConnected.set(accountState.isConnected);

      if (accountState.isConnected && accountState.address) {
        await this.updateBalanceAndNetwork();
        
        const currentChainId = this.chainId();
        const targetChainId = Number(this.configuredChainId());

        if (currentChainId && currentChainId !== targetChainId) {
          // Tự động chuyển sang mạng mong muốn sau khi kết nối thành công để ví không bị lỗi treo unknown network lúc chưa connect
          setTimeout(async () => {
            await this.switchNetwork(targetChainId);
          }, 500);
        } else if (currentChainId) {
          this.checkAndUpdateNetworkState(currentChainId, false);
        }
      } else {
        this.balance.set('0.0000');
        this.chainId.set(null);
        this.networkName.set('Unknown Network');
        this.isWrongChain.set(false);
        this.showWrongChainModal.set(false);
      }
    });

    // Lắng nghe thay đổi mạng lưới
    this.modal.subscribeNetwork((networkState: any) => {
      if (networkState.chainId) {
        const id = Number(networkState.chainId);
        this.checkAndUpdateNetworkState(id, true);
      }

      if (this.isConnected()) {
        this.updateBalanceAndNetwork();
      }
    });
  }

  // Helper đồng bộ hóa và kiểm tra trạng thái mạng EVM
  private checkAndUpdateNetworkState(chainId: number, showToastAlert = true) {
    const prevChainId = this.chainId();
    const prevWrongChain = this.isWrongChain();
    this.chainId.set(chainId);

    const supportedChain = this.supportedChains.find(c => Number(c.id) === chainId);
    const isSupported = !!supportedChain;
    this.isWrongChain.set(!isSupported);

    if (isSupported) {
      this.networkName.set(supportedChain.name);
      this.showWrongChainModal.set(false);
      
      const chainIdStr = chainId.toString();
      this.configuredChainId.set(chainIdStr);
      if (typeof window !== 'undefined') {
        localStorage.setItem('proof_random_configured_chain_id', chainIdStr);
      }

      // Chỉ tự động đóng modal nếu trước đó đang ở sai mạng lưới và nay đã chuyển về đúng mạng
      if (prevWrongChain) {
        try {
          this.modal.close();
        } catch (e) {}
      }
    } else {
      this.networkName.set('Mạng không hỗ trợ');
      if (this.isConnected()) {
        this.showWrongChainModal.set(true);
      } else {
        this.showWrongChainModal.set(false);
      }
    }
  }

  // Cập nhật số dư ví và chainId thực tế bất đồng bộ
  public async updateBalanceAndNetwork() {
    try {
      const walletProvider = this.modal.getWalletProvider();
      const currentAddress = this.address();

      if (walletProvider && currentAddress) {
        const ethersProvider = new BrowserProvider(walletProvider as any);
        const balanceVal = await ethersProvider.getBalance(currentAddress);
        const formattedBalance = formatEther(balanceVal);
        this.balance.set(parseFloat(formattedBalance).toFixed(4));

        const network = await ethersProvider.getNetwork();
        const id = Number(network.chainId);
        this.checkAndUpdateNetworkState(id, false);
      }
    } catch (error) {
      console.error('Lỗi khi cập nhật số dư/mạng:', error);
    }
  }

  private getAppKitNetworkByChainId(chainId: string | number): any {
    const id = chainId.toString().trim();
    switch (id) {
      case '42161': return arbitrum;
      case '421614': return arbitrumSepolia;
      default: return arbitrumSepolia;
    }
  }

  public async connectWallet() {
    if (!this.modal) return;
    try {
      // Ngắt kết nối phiên treo cũ nếu người dùng chưa kết nối active
      if (!this.isConnected()) {
        try {
          await this.modal.disconnect();
        } catch (e) {}
      }
      await this.modal.open();
    } catch (error: any) {
      console.error('Lỗi mở modal kết nối ví:', error);
      // Nếu dính lỗi Connection declined do request cũ active, tự động ngắt phiên treo và mở lại
      if (error?.message?.includes('declined') || error?.message?.includes('active')) {
        try {
          await this.modal.disconnect();
          await this.modal.open();
        } catch (e) {}
      }
    }
  }

  public async openWalletModal() {
    try {
      await this.modal.open({ view: 'Account' });
    } catch (e) {
      console.error('Lỗi mở wallet modal:', e);
    }
  }

  public async disconnectWallet() {
    try {
      await this.modal.disconnect();
      this.address.set(null);
      this.isConnected.set(false);
      this.balance.set('0.0000');
      this.chainId.set(null);
      this.isWrongChain.set(false);
      this.showWrongChainModal.set(false);
    } catch (error) {
      console.error('Lỗi ngắt kết nối ví:', error);
    }
  }

  public async addNetworkToWallet(chainId: number | string): Promise<boolean> {
    if (typeof window === 'undefined' || !(window as any).ethereum) return false;
    const idNum = Number(chainId);
    const hexChainId = '0x' + idNum.toString(16);

    const chainParamsMap: Record<number, any> = {
      421614: {
        chainId: hexChainId,
        chainName: 'Arbitrum Sepolia',
        nativeCurrency: { name: 'Arbitrum Sepolia Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: ['https://sepolia-rollup.arbitrum.io/rpc', 'https://arbitrum-sepolia-rpc.publicnode.com'],
        blockExplorerUrls: ['https://sepolia.arbiscan.io']
      },
      97: {
        chainId: hexChainId,
        chainName: 'BSC Testnet',
        nativeCurrency: { name: 'BNB', symbol: 'tBNB', decimals: 18 },
        rpcUrls: ['https://bsc-testnet-rpc.publicnode.com', 'https://data-seed-prebsc-1-s1.binance.org:8545'],
        blockExplorerUrls: ['https://testnet.bscscan.com']
      },
      42161: {
        chainId: hexChainId,
        chainName: 'Arbitrum One',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum-one-rpc.publicnode.com'],
        blockExplorerUrls: ['https://arbiscan.io']
      }
    };

    const params = chainParamsMap[idNum];
    if (!params) return false;

    try {
      await (window as any).ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [params]
      });
      return true;
    } catch (e) {
      console.warn('[Web3] Thêm mạng vào ví thất bại:', e);
      return false;
    }
  }

  public async switchNetwork(targetChainId: string | number) {
    try {
      const chainIdNum = Number(targetChainId);
      const network = this.supportedChains.find(chain => Number(chain.id) === chainIdNum);
      if (network) {
        try {
          await this.modal.switchNetwork(network as any);
        } catch (switchErr: any) {
          console.warn(`[Web3] AppKit switchNetwork thất bại cho chain ${targetChainId}, thử addNetworkToWallet:`, switchErr);
          const added = await this.addNetworkToWallet(chainIdNum);
          if (!added) throw switchErr;
        }
        this.configuredChainId.set(targetChainId.toString());
        if (typeof window !== 'undefined') {
          localStorage.setItem('proof_random_configured_chain_id', targetChainId.toString());
        }
      }
    } catch (error) {
      console.error(`Lỗi chuyển mạng sang ${targetChainId}:`, error);
    }
  }

  public async getSigner() {
    const walletProvider = this.modal.getWalletProvider();
    if (!walletProvider) {
      throw new Error('Ví chưa được kết nối');
    }
    const ethersProvider = new BrowserProvider(walletProvider as any);
    return await ethersProvider.getSigner();
  }

  public getProvider() {
    const walletProvider = this.modal.getWalletProvider();
    if (walletProvider) {
      return new BrowserProvider(walletProvider as any);
    }
    return new JsonRpcProvider(this.rpcUrl());
  }

  public getContract(withSigner: boolean = false): Contract {
    const address = this.contractAddress();
    if (!address || address === '0x0000000000000000000000000000000000000000') {
      throw new Error('Địa chỉ Smart Contract chưa được cấu hình.');
    }
    if (withSigner) {
      const walletProvider = this.modal?.getWalletProvider();
      if (walletProvider) {
        const browserProvider = new BrowserProvider(walletProvider as any);
        return new Contract(address, PROOF_RANDOM_ABI, browserProvider.getSigner() as any);
      }
    }
    const jsonRpcProvider = new JsonRpcProvider(this.rpcUrl());
    return new Contract(address, PROOF_RANDOM_ABI, jsonRpcProvider);
  }

  public async getContractWithSigner(): Promise<Contract> {
    const signer = await this.getSigner();
    return new Contract(this.contractAddress(), PROOF_RANDOM_ABI, signer);
  }

  private loadGasSettings() {
    if (typeof window === 'undefined') return;
    try {
      const mode = localStorage.getItem('proof_random_gas_mode') as 'default' | 'fast' | 'custom' | null;
      if (mode) this.txSpeed.set(mode);
      const mult = localStorage.getItem('proof_random_gas_multiplier');
      if (mult) this.gasMultiplier.set(parseFloat(mult));
    } catch (e) {
      console.warn('[Web3] Không thể đọc cài đặt gas từ localStorage:', e);
    }
  }

  public setGasMode(mode: 'default' | 'fast' | 'custom') {
    this.txSpeed.set(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('proof_random_gas_mode', mode);
    }
  }

  public setGasMultiplier(mult: number) {
    this.gasMultiplier.set(mult);
    if (typeof window !== 'undefined') {
      localStorage.setItem('proof_random_gas_multiplier', mult.toString());
    }
  }

  // --- CÁC HÀM NGHIỆP VỤ CONTRACT ---

  public async requestDraw(
    drawType: number,
    param1: number,
    param2: number,
    eventName: string,
    participants: string[]
  ): Promise<string> {
    if (!this.isConnected()) {
      throw new Error('Vui lòng kết nối ví trước khi thực hiện.');
    }

    try {
      const overrides: any = {};
      if (this.gasMode() !== 'default') {
        const mult = this.gasMode() === 'fast' ? 2.0 : this.gasMultiplier();
        const multBig = BigInt(Math.round(mult * 100));

        try {
          const readOnlyContract = this.getContract(false);
          const estimatedGas = await readOnlyContract['requestDraw'].estimateGas(
            drawType,
            param1,
            param2,
            eventName,
            participants,
            { from: this.address() }
          );
          overrides.gasLimit = (estimatedGas * multBig) / 100n;
        } catch (e) {
          console.warn('[Web3] Không thể ước tính gasLimit qua RPC công cộng:', e);
        }

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

      const contract = await this.getContractWithSigner();
      const tx = await contract['requestDraw'](drawType, param1, param2, eventName, participants, overrides);
      const receipt = await tx.wait();

      let requestId = '';
      const iface = new Interface(PROOF_RANDOM_ABI);
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
          if (parsed && parsed.name === 'DrawRequested') {
            requestId = parsed.args['requestId'].toString();
            break;
          }
        } catch (e) {}
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

  public getContractForChain(chainId: string): Contract | null {
    const address = WEB3_CONFIG.contracts[chainId];
    if (!address || address === '0x0000000000000000000000000000000000000000') {
      return null;
    }
    const rpcUrl = WEB3_CONFIG.rpcs[chainId] || WEB3_CONFIG.rpcs[WEB3_CONFIG.defaultChainId];
    const jsonRpcProvider = new JsonRpcProvider(rpcUrl);
    return new Contract(address, PROOF_RANDOM_ABI, jsonRpcProvider);
  }

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
        } catch (e) {}
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
        } catch (e) {}
      }
    }
    return null;
  }

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

  public async getDrawSessionsPaginated(page: number, limit: number, forceRefresh = false): Promise<{ draws: any[], total: number }> {
    try {
      const chainId = this.configuredChainId().toString();
      if (!this._paginatedDrawsCache[chainId]) {
        this._paginatedDrawsCache[chainId] = {};
      }

      const cache = this._paginatedDrawsCache[chainId][page];
      const CACHE_DURATION = 180000;

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

      const indices: number[] = [];
      for (let i = startIndex; i >= endIndex; i--) {
        indices.push(i);
      }

      const idPromises = indices.map(idx => contract['requestIds'](idx));
      const requestIdsBig = await Promise.all(idPromises);

      const detailPromises = requestIdsBig.map(reqId => this.getDrawSessionDetails(reqId.toString()));
      const details = await Promise.all(detailPromises);

      for (const d of details) {
        if (d) {
          draws.push(d);
        }
      }

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

  public clearHistoryCache(chainId?: string) {
    if (chainId) {
      this._allDrawsCache[chainId] = [];
      this._hasFullScan[chainId] = false;
      this._paginatedDrawsCache[chainId] = {};
      this._drawSessionDetailsCache[chainId] = {};
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(`proof_random_history_cache_${chainId}`);
        sessionStorage.removeItem(`proof_random_has_full_scan_${chainId}`);
        sessionStorage.removeItem(`proof_random_session_details_${chainId}`);
      }
    } else {
      this._allDrawsCache = {};
      this._hasFullScan = {};
      this._paginatedDrawsCache = {};
      this._drawSessionDetailsCache = {};
      if (typeof window !== 'undefined') {
        const keys = Object.keys(sessionStorage);
        for (const key of keys) {
          if (key.startsWith('proof_random_history_cache_') ||
              key.startsWith('proof_random_has_full_scan_') ||
              key.startsWith('proof_random_session_details_')) {
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
    } catch (e) {}
  }

  private loadCacheFromSessionStorage() {
    if (typeof window === 'undefined') return;
    try {
      const chainId = this.configuredChainId().toString();
      const rawHistory = sessionStorage.getItem(`proof_random_history_cache_${chainId}`);
      if (rawHistory) this._allDrawsCache[chainId] = JSON.parse(rawHistory);
      const rawFullScan = sessionStorage.getItem(`proof_random_has_full_scan_${chainId}`);
      if (rawFullScan) this._hasFullScan[chainId] = JSON.parse(rawFullScan);
      const rawDetails = sessionStorage.getItem(`proof_random_session_details_${chainId}`);
      if (rawDetails) this._drawSessionDetailsCache[chainId] = JSON.parse(rawDetails);
      const rawStats = sessionStorage.getItem(`proof_random_dashboard_stats_${chainId}`);
      if (rawStats) this._dashboardStatsCache[chainId] = JSON.parse(rawStats);
    } catch (e) {}
  }
}
