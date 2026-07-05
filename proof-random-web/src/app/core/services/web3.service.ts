import { Injectable, signal, computed } from '@angular/core';
import { BrowserProvider, Contract, JsonRpcProvider, formatEther, Interface, solidityPackedKeccak256 } from 'ethers';
import { Subject } from 'rxjs';
import { WEB3_CONFIG } from '../config/web3.config';
import { PROOF_RANDOM_ABI } from './proof-random-abi';

// ABI tối giản của Chainlink VRF Coordinator V2Plus để đọc thông tin subscription
// Dùng human-readable ABI string để ethers.js v6 decode result object đúng tên trường
const VRF_COORDINATOR_ABI = [
  'function getSubscription(uint256 subId) view returns (uint96 balance, uint96 nativeBalance, uint64 reqCount, address owner, address[] consumers)'
];

// Địa chỉ VRF Coordinator V2.5 chính xác trên từng mạng (fallback nếu cần)
const VRF_COORDINATORS: Record<string, string> = {
  '42161':   '0x5C210e48983947b7F8Ee713D9b1E003565e3F030', // Arbitrum One
  '421614':  '0x5CE801a2c317E05C558F87353f2257D5f25a3D61', // Arbitrum Sepolia
};

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

  // Cấu hình mạng mặc định và contract hiện hành
  public readonly configuredChainId = signal<string>(WEB3_CONFIG.defaultChainId);
  public readonly activeNetwork = computed(() => {
    return this.configuredChainId() === '42161' ? 'arbitrum' : 'arbitrumSepolia';
  });

  public readonly contractAddress = computed(() => {
    return this.configuredChainId() === '42161' 
      ? WEB3_CONFIG.contracts.arbitrum 
      : WEB3_CONFIG.contracts.arbitrumSepolia;
  });

  public readonly rpcUrl = computed(() => {
    return this.configuredChainId() === '42161'
      ? WEB3_CONFIG.rpcs.arbitrum
      : WEB3_CONFIG.rpcs.arbitrumSepolia;
  });

  public readonly explorerUrl = computed(() => {
    return this.configuredChainId() === '42161'
      ? WEB3_CONFIG.explorers.arbitrum
      : WEB3_CONFIG.explorers.arbitrumSepolia;
  });

  // Địa chỉ ví rút gọn (0x1234...abcd)
  public readonly shortAddress = computed(() => {
    const addr = this.currentAccount();
    if (!addr) return '';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  });

  // Kiểm tra xem ví có đang kết nối sai mạng hay không (chỉ chấp nhận 42161 và 421614)
  public readonly isWrongChain = computed(() => {
    if (!this.walletConnected()) return false;
    const connectedChain = this.chainId().toString().trim();
    return connectedChain !== '42161' && connectedChain !== '421614';
  });

  // Tên mạng đang được sử dụng
  public readonly networkName = computed(() => {
    const id = this.walletConnected() ? this.chainId() : this.configuredChainId();
    if (id.toString() === '42161') return 'Arbitrum One';
    if (id.toString() === '421614') return 'Arbitrum Sepolia';
    if (id.toString() === '31337' || id.toString() === '1337') return 'Hardhat Localhost';
    return `Mạng EVM khác (ID: ${id})`;
  });

  // Ký hiệu token của mạng đang sử dụng (ETH, BNB, POL, v.v.)
  public readonly networkSymbol = computed(() => {
    const id = this.walletConnected() ? this.chainId() : this.configuredChainId();
    const idStr = id.toString();
    if (idStr === '56' || idStr === '97') return 'BNB';
    if (idStr === '137' || idStr === '80001' || idStr === '80002') return 'POL';
    return 'ETH';
  });

  private provider: BrowserProvider | null = null;
  private modal: any = null;

  constructor() {
    this.initAppKit();
  }

  /**
   * Khởi tạo Reown AppKit cho ví WalletConnect
   */
  private initAppKit() {
    if (typeof window === 'undefined') return;

    try {
      const projectId = WEB3_CONFIG.walletConnectProjectId;
      const ethersAdapter = new EthersAdapter();

      this.modal = createAppKit({
        adapters: [ethersAdapter],
        networks: [arbitrum, arbitrumSepolia],
        defaultNetwork: arbitrum,
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
          email: false,
          socials: false,
          analytics: false,
          reownAuthentication: false
        }
      });

      // Lắng nghe thay đổi tài khoản từ AppKit
      this.modal.subscribeAccount((accountState: any) => {
        const address = accountState.address;
        const isConnected = accountState.isConnected;

        if (isConnected && address) {
          this.currentAccount.set(address);
          this.walletConnected.set(true);
          
          // Sử dụng setTimeout để tránh xung đột RPC và nghẽn luồng trong quá trình bắt tay kết nối ví
          setTimeout(() => {
            this.updateBalanceAndStatus(address);
          }, 150);
        } else {
          this.walletConnected.set(false);
          this.currentAccount.set('');
          this.walletBalance.set('0.00');
        }
      });

      // Lắng nghe thay đổi chain mạng lưới
      this.modal.subscribeNetwork((networkState: any) => {
        if (networkState && networkState.caipNetworkId) {
          const caipId = networkState.caipNetworkId.toString();
          const cleanChainId = caipId.split(':').pop() || '';
          this.chainId.set(cleanChainId);
          // Cập nhật cấu hình mạng mặc định theo ví (nếu là mạng hợp lệ)
          if (cleanChainId === '42161' || cleanChainId === '421614') {
            this.configuredChainId.set(cleanChainId);
          }
          
          // Khi đổi chain, cập nhật lại số dư ví sau một khoảng trễ nhỏ
          const currentAddr = this.currentAccount();
          if (currentAddr) {
            setTimeout(() => {
              this.updateBalanceAndStatus(currentAddr);
            }, 250);
          }
        }
      });

    } catch (err) {
      console.error('[Web3] Khởi tạo AppKit thất bại:', err);
    }
  }

  /**
   * Cập nhật số dư ví và trạng thái
   */
  private async updateBalanceAndStatus(address: string) {
    try {
      if (typeof window === 'undefined') return;
      
      // Sử dụng JsonRpcProvider công cộng thay vì truy vấn qua ví đối với tác vụ đọc số dư
      // Điều này loại bỏ hoàn toàn các xung đột RPC (previous request is still active) khi kết nối ví
      const rpc = this.rpcUrl();
      const tempProvider = new JsonRpcProvider(rpc);
      const balanceBigInt = await tempProvider.getBalance(address);
      const balance = formatEther(balanceBigInt);
      this.walletBalance.set(parseFloat(balance).toFixed(4));
    } catch (err) {
      console.warn('[Web3] Lấy số dư ví lỗi:', err);
    }
  }

  public async connectWallet(): Promise<void> {
    if (this.modal) {
      await this.modal.open();
    } else {
      this.walletError.set('WalletConnect AppKit chưa được khởi tạo.');
    }
  }

  /**
   * Mở modal chi tiết tài khoản ví
   */
  public async openWalletModal(): Promise<void> {
    if (this.modal) {
      await this.modal.open({ view: 'Account' });
    }
  }

  /**
   * Ngắt kết nối ví
   */
  public async disconnectWallet(): Promise<void> {
    if (this.modal) {
      await this.modal.disconnect();
      this.walletConnected.set(false);
      this.currentAccount.set('');
      this.walletBalance.set('0.00');
    }
  }

  /**
   * Chuyển đổi mạng lưới về Arbitrum hoặc Arbitrum Sepolia
   */
  public async switchNetwork(targetChainId: string): Promise<void> {
    try {
      if (this.modal) {
        const net = targetChainId === '42161' ? arbitrum : arbitrumSepolia;
        await this.modal.switchNetwork(net);
        this.configuredChainId.set(targetChainId);
      }
    } catch (err: any) {
      console.error('[Web3] Chuyển mạng thất bại:', err);
      this.walletError.set(err.message || 'Không thể chuyển mạng.');
    }
  }

  /**
   * Khởi tạo đối tượng Smart Contract của FairDraw
   * Hỗ trợ read-only qua RPC công cộng nếu ví chưa kết nối
   */
  public getContract(withSigner: boolean = false): Contract {
    const address = this.contractAddress();
    if (!address || address === '0x0000000000000000000000000000000000000000') {
      throw new Error('Địa chỉ Smart Contract chưa được cấu hình. Vui lòng deploy và cập nhật web3.config.ts.');
    }
    // Read-only: luôn dùng JsonRpcProvider
    const jsonRpcProvider = new JsonRpcProvider(this.rpcUrl());
    return new Contract(address, PROOF_RANDOM_ABI, jsonRpcProvider);
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
    
    // Ưu tiên sử dụng provider thực tế của WalletConnect AppKit nếu khả dụng
    const walletProvider = this.modal?.getWalletProvider();
    if (!walletProvider) {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const browserProvider = new BrowserProvider((window as any).ethereum);
        const signer = await browserProvider.getSigner();
        return new Contract(address, PROOF_RANDOM_ABI, signer);
      }
      throw new Error('Không thể tìm thấy provider của ví.');
    }
    
    const browserProvider = new BrowserProvider(walletProvider);
    const signer = await browserProvider.getSigner();
    return new Contract(address, PROOF_RANDOM_ABI, signer);
  }

  /**
   * Gửi yêu cầu bốc thăm lên blockchain (Write)
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
    if (this.isWrongChain()) {
      throw new Error('Ví đang kết nối sai mạng. Vui lòng chuyển sang Arbitrum hoặc Arbitrum Sepolia.');
    }

    try {
      // Dùng getContractWithSigner() để đảm bảo được await getSigner() đúng cách (ethers v6)
      const contract = await this.getContractWithSigner();
      const tx = await contract['requestDraw'](drawType, param1, param2, eventName, participants);
      console.log('[Web3] Giao dịch gửi requestDraw:', tx.hash);
      const receipt = await tx.wait();
      
      // Tìm requestId từ Event logs của giao dịch
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
          // Log không khớp ABI, bỏ qua
        }
      }

      return requestId || receipt.hash;
    } catch (err: any) {
      console.error('[Web3] Gửi yêu cầu bốc thăm thất bại:', err);
      // Trích xuất thông báo lỗi của Solidity revert nếu có
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
    const address = chainId === '42161' 
      ? WEB3_CONFIG.contracts.arbitrum 
      : WEB3_CONFIG.contracts.arbitrumSepolia;
      
    if (!address || address === '0x0000000000000000000000000000000000000000') {
      return null;
    }
    
    const rpcUrl = chainId === '42161'
      ? WEB3_CONFIG.rpcs.arbitrum
      : WEB3_CONFIG.rpcs.arbitrumSepolia;
      
    const jsonRpcProvider = new JsonRpcProvider(rpcUrl);
    return new Contract(address, PROOF_RANDOM_ABI, jsonRpcProvider);
  }

  /**
   * Tự động dò tìm xem query (RequestID hoặc Tx Hash) thuộc về mạng lưới nào (Sepolia hay Mainnet)
   * và cập nhật cấu hình dApp (configuredChainId) sang mạng đó.
   */
  public async detectAndSwitchChain(query: string): Promise<string | null> {
    if (!query) return null;
    const cleanQuery = query.trim();

    // 1. Nếu là Tx Hash (bắt đầu bằng 0x và dài 66 ký tự)
    if (cleanQuery.startsWith('0x') && cleanQuery.length === 66) {
      const chains = ['421614', '42161'];
      for (const cid of chains) {
        try {
          const rpcUrl = cid === '42161'
            ? WEB3_CONFIG.rpcs.arbitrum
            : WEB3_CONFIG.rpcs.arbitrumSepolia;
          const provider = new JsonRpcProvider(rpcUrl);
          const tx = await provider.getTransaction(cleanQuery);
          if (tx) {
            console.log(`[Web3] Phát hiện Tx Hash trên mạng ${cid}. Tự động chuyển cấu hình.`);
            this.configuredChainId.set(cid);
            return cid;
          }
        } catch (e) {
          // Thử tiếp
        }
      }
    } else {
      // 2. Nếu là Request ID
      const chains = ['421614', '42161'];
      for (const cid of chains) {
        try {
          const contract = this.getContractForChain(cid);
          if (!contract) continue;
          
          const session = await contract['sessions'](cleanQuery);
          if (session && session.creator !== '0x0000000000000000000000000000000000000000') {
            console.log(`[Web3] Phát hiện RequestID trên mạng ${cid}. Tự động chuyển cấu hình.`);
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
   * Đọc dữ liệu thô của 1 phiên bốc thăm từ mapping sessions
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
   * Quét sự kiện DrawCreated để khôi phục lịch sử bốc thăm và danh sách người tham gia
   */
  public async getAllDrawSessionsFromEvents(): Promise<any[]> {
    try {
      const contract = this.getContract(false);
      // Quét từ khối 0 (hoặc khối deploy thực tế của bạn để tăng hiệu năng)
      const filter = contract['filters']['DrawCreated']();
      const events = await contract.queryFilter(filter, 0, 'latest');
      
      const draws: any[] = [];
      for (const event of events) {
        const args = (event as any).args;
        const parsed = this.parseEventNameAndSkin(args.eventName);
        draws.push({
          requestId: args.requestId.toString(),
          creator: args.creator,
          eventName: parsed.eventName,
          skin: parsed.skin,
          drawType: Number(args.drawType),
          participants: args.participants,
          param1: Number(args.param1),
          param2: Number(args.param2),
          txHash: event.transactionHash,
          blockNumber: event.blockNumber
        });
      }
      // Trả về danh sách xếp theo thứ tự mới nhất lên đầu
      return draws.reverse();
    } catch (err) {
      console.error('[Web3] Lấy danh sách draw từ event logs lỗi:', err);
      return [];
    }
  }

  /**
   * Lấy chi tiết phiên bốc thăm bao gồm cả mảng người tham gia và Tx Hash
   */
  public async getDrawSessionDetails(requestId: string): Promise<any> {
    try {
      const sessionData = await this.getDrawSession(requestId);
      if (!sessionData) return null;

      const contract = this.getContract(false);
      
      // Quét event DrawCreated cụ thể của requestId này để lấy danh sách người tham gia
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

      return {
        ...sessionData,
        participants,
        txHash,
        blockNumber
      };
    } catch (err) {
      console.error('[Web3] Lấy chi tiết bốc thăm lỗi:', err);
      return null;
    }
  }

  /**
   * Tính toán kết quả bốc thăm deterministic trên Client-side dựa trên randomWord (giống hệt Smart Contract)
   * Sử dụng để xác minh tính minh bạch của kết quả
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

    // 1. Random Number
    if (drawType === 1) {
      const min = BigInt(param1);
      const max = BigInt(param2);
      const resultVal = min + (seed % (max - min + 1n));
      return {
        result: resultVal.toString(),
        winners: [resultVal.toString()]
      };
    }
    // 2. Random Name
    else if (drawType === 2) {
      const idx = Number(seed % BigInt(param1));
      const winnerName = participants && participants[idx] ? participants[idx] : `Index: ${idx}`;
      return {
        result: idx.toString(),
        winners: [winnerName]
      };
    }
    // 3. Multiple Winners (Chọn K người không trùng)
    else if (drawType === 3) {
      const total = param1;
      const k = param2;
      const winners: string[] = [];
      const winnerIndices: number[] = [];
      
      let tempRandom = seed;
      const selected = new Array<number>(k);

      for (let i = 0; i < k; i++) {
        // Hash deterministic bằng cách băm chuỗi keccak256
        const hashHex = this.solidityKeccak256(['uint256', 'uint256'], [tempRandom.toString(), i.toString()]);
        tempRandom = BigInt(hashHex);
        let candidate = Number(tempRandom % BigInt(total));

        // Check trùng
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
    // 4. Coin Flip
    else if (drawType === 4) {
      const res = seed % 2n === 0n ? 'Heads' : 'Tails';
      return { result: res, winners: [res] };
    }
    // 5. Dice
    else if (drawType === 5) {
      const sides = BigInt(param1);
      const resVal = 1n + (seed % sides);
      return { result: resVal.toString(), winners: [`Mặt ${resVal}`] };
    }
    // 6. Even / Odd
    else if (drawType === 6) {
      const res = seed % 2n === 0n ? 'Even' : 'Odd';
      return { result: res, winners: [res] };
    }
    // 7. Random Color
    else if (drawType === 7) {
      const hashHex = this.solidityKeccak256(['uint256'], [seed.toString()]);
      // Solidity lấy 3 byte cuối từ phải sang trái (hash[31], hash[30], hash[29])
      const byte31 = hashHex.substring(hashHex.length - 2);
      const byte30 = hashHex.substring(hashHex.length - 4, hashHex.length - 2);
      const byte29 = hashHex.substring(hashHex.length - 6, hashHex.length - 4);
      const color = ('#' + byte31 + byte30 + byte29).toUpperCase();
      return { result: color, winners: [color] };
    }
    // 8. Random Letter
    else if (drawType === 8) {
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const idx = Number(seed % 26n);
      const letter = letters[idx];
      return { result: letter, winners: [letter] };
    }
    // 9. Random Team (Chia người tham gia vào các đội)
    else if (drawType === 9) {
      const total = param1;
      const numTeams = param2;
      const teams: { name: string; members: string[] }[] = [];
      
      // Tạo các đội
      for (let t = 0; t < numTeams; t++) {
        teams.push({ name: `Team ${String.fromCharCode(65 + t)}`, members: [] }); // Team A, B, C...
      }

      // Xáo trộn chỉ số người tham gia dựa trên seed (Fisher-Yates)
      const indices = Array.from({ length: total }, (_, i) => i);
      let tempRandom = seed;

      for (let i = total - 1; i > 0; i--) {
        const hashHex = this.solidityKeccak256(['uint256', 'uint256'], [tempRandom.toString(), i.toString()]);
        tempRandom = BigInt(hashHex);
        const swapIdx = Number(tempRandom % BigInt(i + 1));
        
        // Swap
        const temp = indices[i];
        indices[i] = indices[swapIdx];
        indices[swapIdx] = temp;
      }

      // Chia tuần tự vào các đội
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
   * Lấy số dư LINK trong Chainlink VRF Subscription của contract
   * Đọc cả s_vrfCoordinator và s_subscriptionId trực tiếp từ contract
   */
  public async getLinkSubscriptionBalance(): Promise<{ balance: string; subscriptionId: string } | null> {
    try {
      const rpcProvider = new JsonRpcProvider(this.rpcUrl());
      const proofContract = new Contract(this.contractAddress(), PROOF_RANDOM_ABI, rpcProvider);

      // Đọc cả hai giá trị song song để tiết kiệm RPC round-trip
      const [subId, coordinatorAddress]: [bigint, string] = await Promise.all([
        proofContract['s_subscriptionId'](),
        proofContract['s_vrfCoordinator']()
      ]);

      if (!subId || subId === 0n) {
        console.warn('[Web3] s_subscriptionId = 0, bỏ qua');
        return null;
      }
      if (!coordinatorAddress || coordinatorAddress === '0x0000000000000000000000000000000000000000') {
        console.warn('[Web3] s_vrfCoordinator rỗng, bỏ qua');
        return null;
      }

      console.log('[Web3] subId:', subId.toString(), '| coordinator:', coordinatorAddress);

      // Truy vấn Chainlink VRF Coordinator để lấy balance
      const coordinator = new Contract(coordinatorAddress, VRF_COORDINATOR_ABI, rpcProvider);
      const subInfo = await coordinator['getSubscription'](subId);
      console.log('[Web3] subInfo:', subInfo);

      // getSubscription trả về tuple/struct - truy cập theo tên trường
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

  public solidityKeccak256(types: string[], values: any[]): string {
    return solidityPackedKeccak256(types, values);
  }
}
