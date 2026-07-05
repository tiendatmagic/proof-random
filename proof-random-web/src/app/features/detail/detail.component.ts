import { GameShowcaseComponent } from './components/game-showcase/game-showcase.component';
import { Component, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Web3Service } from '../../core/services/web3.service';
import { ToastService } from '../../core/services/toast.service';
import { CardComponent } from '../../shared/components/card/card.component';
import { SkeletonLoaderComponent } from '../../shared/components/skeleton-loader/skeleton-loader.component';
import { HashStep, DirectModResult } from '../verify/verify.component';

@Component({
  selector: 'app-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, CardComponent, SkeletonLoaderComponent, GameShowcaseComponent],
  templateUrl: './detail.component.html'
})
export class DetailComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  public readonly web3Service = inject(Web3Service);
  private readonly toastService = inject(ToastService);

  public readonly requestId = signal<string>('');
  public readonly sessionDetails = signal<any | null>(null);
  public readonly clientResult = signal<any | null>(null);
  public readonly isLoading = signal<boolean>(true);

  // Trạng thái hiển thị popup QR
  public readonly showQrModal = signal<boolean>(false);

  // Chuỗi bước hash xác minh thuật toán công khai
  public readonly hashSteps = signal<HashStep[]>([]);
  public readonly directModResult = signal<DirectModResult | null>(null);
  public readonly isHashChain = signal<boolean>(false);

  public readonly waitingTime = signal<number>(0);
  private timerInterval: any = null;

  // Lưu trữ interval để dọn dẹp (polling)
  private pollingInterval: any = null;

  // Lưu trữ animation frame ID và timeout ID để dọn dẹp khi bỏ qua (skip)
  private raceAnimationFrameId: any = null;
  private wheelAnimationFrameId: any = null;
  private boxTimeoutId: any = null;
  private bauCuaTimeoutId: any = null;
  private plinkoAnimationFrameId: any = null;
  private slotIntervalId: any = null;
  private slotTimeoutId: any = null;
  private oanTuTiTimeoutId: any = null;
  private vietlottIntervalId: any = null;
  private tarotTimeoutId: any = null;
  private bingoTimeoutId: any = null;
  private bingoIntervalId: any = null;

  constructor() {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.requestId.set(id);
    
    // Thiết lập dữ liệu tạm thời để giao diện hiển thị ngay màn hình chờ bốc thăm
    this.sessionDetails.set({
      requestId: id,
      fulfilled: false,
      eventName: 'Đang kết nối blockchain...',
      participants: [],
      drawType: 2
    });
    
    // Nếu là phiên bốc thăm mới tinh vừa tạo, tắt Skeleton Loader ngay lập tức để hiện màn hình chờ VRF và đếm giây
    const isFresh = this.route.snapshot.queryParamMap.get('fresh') === 'true';
    if (isFresh) {
      this.isLoading.set(false);
    }
    
    this.loadSessionDetails();
  }

  /**
   * Tải chi tiết phiên bốc thăm từ blockchain
   */
  public async loadSessionDetails() {
    const id = this.requestId();
    if (!id) return;

    try {
      // Tự động dò tìm mạng chứa RequestID này (Sepolia hay Mainnet)
      await this.web3Service.detectAndSwitchChain(id);

      const data = await this.web3Service.getDrawSessionDetails(id);
      if (data) {
        this.sessionDetails.set(data);

        // Tính toán kết quả chi tiết ở client nếu đã có số ngẫu nhiên
        if (data.fulfilled && data.randomWord && data.randomWord !== '0') {
          const res = this.web3Service.calculateResultClientSide(
            data.drawType,
            data.param1,
            data.param2,
            data.randomWord,
            data.participants
          );
          this.clientResult.set(res);
          this.buildHashSteps(data); // Sinh bước hash hiển thị thuật toán công khai
          this.stopPolling(); // Dừng polling nếu đã nhận được kết quả
          
        } else {
          // Bắt đầu cơ chế polling nếu chưa nhận được kết quả (đang chờ VRF callback)
          this.startPolling();
        }
      } else {
        // Nếu không tìm thấy dữ liệu (thường do RPC lag chưa sync kịp block chứa draw mới), 
        // ta vẫn chạy polling để tự động cập nhật khi blockchain đồng bộ xong.
        this.startPolling();
      }
    } catch (err) {
      console.error('[Detail] Tải chi tiết lỗi:', err);
      // Tiếp tục polling đề phòng lỗi kết nối RPC tạm thời
      this.startPolling();
    } finally {
      this.isLoading.set(false);
    }
  }

  /** Rút gọn hash/số thành dạng 0x1234...abcd hoặc 12345...890 */
  public shortHash(val: string): string {
    if (!val || val.length <= 14) return val;
    return `${val.substring(0, 10)}...${val.substring(val.length - 6)}`;
  }

  /** Copy text vào clipboard */
  public copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      this.toastService.showToast('Đã sao chép!', 'success');
    });
  }

  /**
   * Sinh danh sách bước tính toán hash để hiển thị thuật toán công khai
   */
  private buildHashSteps(details: any): void {
    this.hashSteps.set([]);
    this.directModResult.set(null);
    this.isHashChain.set(false);

    if (!details || !details.randomWord || details.randomWord === '0') return;

    const drawType = details.drawType as number;
    const param1 = details.param1 as number;
    const param2 = details.param2 as number;
    const randomWord = details.randomWord as string;
    const participants = details.participants as string[];
    const seed = BigInt(randomWord);

    if (drawType === 1) {
      const min = BigInt(param1);
      const max = BigInt(param2);
      const range = max - min + 1n;
      const mod = seed % range;
      const result = (min + mod).toString();
      
      if (details.skin === 'OanTuTi') {
        const hands = ['Kéo', 'Búa', 'Bao'];
        const playerMod = Number(seed % 3n);
        const cpuMod = Number((seed / 3n) % 3n);
        const playerHand = hands[playerMod];
        const cpuHandVal = hands[cpuMod];
        
        let stepResultText = '';
        if (playerMod === cpuMod) {
          stepResultText = `Người chơi (${playerHand}) HÒA Máy (${cpuHandVal})`;
        } else if ((playerMod === 0 && cpuMod === 2) || (playerMod === 1 && cpuMod === 0) || (playerMod === 2 && cpuMod === 1)) {
          stepResultText = `Người chơi (${playerHand}) CHIẾN THẮNG Máy (${cpuHandVal})`;
        } else {
          stepResultText = `Máy (${cpuHandVal}) CHIẾN THẮNG Người chơi (${playerHand})`;
        }

        this.directModResult.set({
          label: 'Oản tù tì (OanTuTi) — Tính trực tiếp từ randomWord',
          formula: `Player = randomWord % 3; CPU = (randomWord / 3) % 3`,
          modulo: `Player = ${randomWord} % 3 = ${playerMod} (${playerHand}); CPU = (${randomWord} / 3) % 3 = ${cpuMod} (${cpuHandVal})`,
          result: stepResultText
        });
      } else {
        this.directModResult.set({
          label: 'Random Number — Tính trực tiếp từ randomWord',
          formula: `randomWord % (max − min + 1) + min`,
          modulo: `${randomWord} % ${range.toString()} = ${mod.toString()}`,
          result: `Vị trí: ${mod.toString()} → Kết quả: ${result}`
        });
      }
      return;
    }

    if (drawType === 2) {
      const total = BigInt(param1);
      const idx = seed % total;
      const name = participants && participants[Number(idx)] ? participants[Number(idx)] : `Index: ${idx}`;
      
      const skinsWithStep: Record<string, string> = {
        Plinko: 'Thả bóng Plinko',
        SlotMachine: 'Slot Machine',
        CardDraw: 'Bốc bài tây',
        LuckyWheel: 'Vòng quay may mắn',
        Racing: 'Đua xe ngẫu nhiên',
        MysteryBox: 'Hộp quà bí ẩn',
        WhatToEat: 'Hôm nay ăn gì?'
      };

      const prefix = details.skin && skinsWithStep[details.skin] ? `${skinsWithStep[details.skin]} — ` : 'Random Name — ';
      
      this.directModResult.set({
        label: `${prefix}Tính trực tiếp từ randomWord`,
        formula: `randomWord % tổng số người tham gia`,
        modulo: `${randomWord} % ${param1} = ${idx.toString()}`,
        result: `Vị trí: ${idx.toString()} → Người thắng: "${name}"`
      });
      return;
    }

    if (drawType === 4) {
      const mod = seed % 2n;
      this.directModResult.set({
        label: 'Coin Flip — Tính trực tiếp từ randomWord',
        formula: `randomWord % 2`,
        modulo: `${randomWord} % 2 = ${mod.toString()}`,
        result: `Kết quả: ${mod === 0n ? '0 → Heads (Mặt ngửa)' : '1 → Tails (Mặt sấp)'}`
      });
      return;
    }

    if (drawType === 5) {
      const sides = BigInt(param1);
      const mod = seed % sides;
      const result = (1n + mod).toString();
      this.directModResult.set({
        label: `Dice Roll (${param1} mặt) — Tính trực tiếp từ randomWord`,
        formula: `1 + (randomWord % số mặt xúc xắc)`,
        modulo: `1 + (${randomWord} % ${param1}) = 1 + ${mod.toString()} = ${result}`,
        result: `Kết quả: Mặt số ${result}`
      });
      return;
    }

    if (drawType === 6) {
      const mod = seed % 2n;
      this.directModResult.set({
        label: 'Even/Odd — Tính trực tiếp từ randomWord',
        formula: `randomWord % 2`,
        modulo: `${randomWord} % 2 = ${mod.toString()}`,
        result: `Kết quả: ${mod === 0n ? '0 → Even (Chẵn)' : '1 → Odd (Lẻ)'}`
      });
      return;
    }

    if (drawType === 8) {
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const mod = seed % 26n;
      const letter = letters[Number(mod)];
      this.directModResult.set({
        label: 'Random Letter — Tính trực tiếp từ randomWord',
        formula: `randomWord % 26 → chữ cái A-Z`,
        modulo: `${randomWord} % 26 = ${mod.toString()}`,
        result: `Vị trí: ${mod.toString()} → Chữ cái: "${letter}"`
      });
      return;
    }

    // --- Hash chain group ---
    this.isHashChain.set(true);

    if (drawType === 7) {
      const hashHex = this.web3Service.solidityKeccak256(['uint256'], [randomWord]);
      const byte31 = hashHex.substring(hashHex.length - 2);
      const byte30 = hashHex.substring(hashHex.length - 4, hashHex.length - 2);
      const byte29 = hashHex.substring(hashHex.length - 6, hashHex.length - 4);
      const color = ('#' + byte31 + byte30 + byte29).toUpperCase();
      this.hashSteps.set([{
        stepIndex: 1,
        label: 'Bước 1 — Băm randomWord → Mã màu HEX',
        inputSeed: this.shortHash(randomWord),
        inputSeedFull: randomWord,
        hashOutput: this.shortHash(hashHex),
        hashOutputFull: hashHex,
        poolSizeBefore: 0,
        indexChosen: 0,
        valueChosen: `3 byte cuối đảo ngược (hash[31], hash[30], hash[29]): "${(byte31 + byte30 + byte29).toUpperCase()}" → Màu: ${color}`
      }]);
      return;
    }

    if (drawType === 3) {
      const k = param2;
      const total = param1;
      const steps: HashStep[] = [];
      let tempRandom = seed;
      const winnerIndices: number[] = [];

      const pool = Array.from({ length: total }, (_, i) => i);

      let labelPrefix = 'Chọn người thắng thứ';
      if (details.skin === 'Sequence') {
        labelPrefix = 'Xếp hạng vị trí thứ';
      } else if (details.skin && details.skin.startsWith('Seating')) {
        labelPrefix = 'Xếp vào chỗ ngồi thứ';
      } else if (details.skin === 'WhatToEat') {
        labelPrefix = 'Chọn món ăn thứ';
      } else if (details.skin === 'Bingo') {
        labelPrefix = 'Chọn bóng Bingo thứ';
      } else if (details.skin === 'RandomLetter') {
        labelPrefix = 'Chọn chữ cái thứ';
      } else if (details.skin === 'Dice') {
        labelPrefix = 'Tung xúc xắc thứ';
      } else if (details.skin === 'CoinFlip') {
        labelPrefix = 'Lật đồng xu thứ';
      }

      for (let i = 0; i < k; i++) {
        const hashHex = this.web3Service.solidityKeccak256(
          ['uint256', 'uint256'],
          [tempRandom.toString(), BigInt(i).toString()]
        );
        const randVal = BigInt(hashHex);
        const poolIndex = Number(randVal % BigInt(pool.length));
        const originalIndex = pool.splice(poolIndex, 1)[0];
        winnerIndices.push(originalIndex);

        const rawName = participants && participants[originalIndex] ? participants[originalIndex] : `Index ${originalIndex}`;
        const name = rawName.replace(/_\d+$/, '');
        
        let valueChosenText = `Vị trí trong pool: ${poolIndex} (người thứ ${originalIndex}) → Trúng giải: "${name}"`;
        if (details.skin === 'Sequence') {
          valueChosenText = `Chọn từ pool vị trí ${poolIndex} (người thứ ${originalIndex}) → Xếp hạng #${i + 1}: "${name}"`;
        } else if (details.skin && details.skin.startsWith('Seating')) {
          const cols = parseInt(details.skin.split('-')[1]) || 4;
          const row = Math.floor(i / cols) + 1;
          const col = (i % cols) + 1;
          valueChosenText = `Chọn từ pool vị trí ${poolIndex} → Xếp vào Hàng ${row}, Cột ${col} (Bàn ${i + 1}): "${name}"`;
        } else if (details.skin === 'WhatToEat') {
          valueChosenText = `Chọn từ pool vị trí ${poolIndex} (món thứ ${originalIndex}) → Món ăn: "${name}"`;
        } else if (details.skin === 'Bingo') {
          valueChosenText = `Chọn từ pool vị trí ${poolIndex} → Bóng số: ${originalIndex + 1}`;
        } else if (details.skin === 'RandomLetter') {
          valueChosenText = `Chọn từ pool vị trí ${poolIndex} → Chữ cái: "${name}"`;
        } else if (details.skin === 'Dice') {
          valueChosenText = `Chọn từ pool vị trí ${poolIndex} → Xúc xắc: Mặt số ${name}`;
        } else if (details.skin === 'CoinFlip') {
          valueChosenText = `Chọn từ pool vị trí ${poolIndex} → Đồng xu: Mặt ${name}`;
        }

        steps.push({
          stepIndex: i + 1,
          label: `Lượt ${i + 1} — ${labelPrefix} ${i + 1}`,
          inputSeed: this.shortHash(tempRandom.toString()),
          inputSeedFull: tempRandom.toString(),
          hashOutput: this.shortHash(hashHex),
          hashOutputFull: hashHex,
          poolSizeBefore: pool.length + 1,
          indexChosen: poolIndex,
          valueChosen: valueChosenText
        });

        tempRandom = randVal;
      }
      this.hashSteps.set(steps);
      return;
    }

    if (drawType === 9) {
      const numTeams = param2;
      const total = param1;
      const steps: HashStep[] = [];
      let tempRandom = seed;

      const pool = Array.from({ length: total }, (_, i) => i);

      for (let i = 0; i < total; i++) {
        const hashHex = this.web3Service.solidityKeccak256(
          ['uint256', 'uint256'],
          [tempRandom.toString(), BigInt(i).toString()]
        );
        const randVal = BigInt(hashHex);
        const poolIndex = Number(randVal % BigInt(pool.length));
        const memberIndex = pool.splice(poolIndex, 1)[0];
        const assignedTeam = (i % numTeams) + 1;

        const name = participants && participants[memberIndex] ? participants[memberIndex] : `Index ${memberIndex}`;
        steps.push({
          stepIndex: i + 1,
          label: `Bước ${i + 1} — Chia thành viên thứ ${i + 1}`,
          inputSeed: this.shortHash(tempRandom.toString()),
          inputSeedFull: tempRandom.toString(),
          hashOutput: this.shortHash(hashHex),
          hashOutputFull: hashHex,
          poolSizeBefore: pool.length + 1,
          indexChosen: poolIndex,
          valueChosen: `Chọn thành viên: "${name}" (từ pool vị trí ${poolIndex}) → Đội ${assignedTeam}`
        });

        tempRandom = randVal;
      }
      this.hashSteps.set(steps);
      return;
    }

    // --- Skin: Bầu Cua Tôm Cá ---
    if (details.skin === 'BauCua') {
      this.isHashChain.set(true);
      const bauCuaNames = ['Bầu', 'Cua', 'Tôm', 'Cá', 'Gà', 'Nai'];
      const steps: HashStep[] = [];

      const d1 = Number(seed % 6n);
      steps.push({
        stepIndex: 1,
        label: 'Xúc xắc 1 — Tính trực tiếp từ randomWord',
        inputSeed: this.shortHash(randomWord),
        inputSeedFull: randomWord,
        hashOutput: 'mod trực tiếp',
        hashOutputFull: randomWord,
        poolSizeBefore: 6,
        indexChosen: d1,
        valueChosen: `${randomWord} % 6 = ${d1} → ${bauCuaNames[d1]}`
      });

      const hash2 = this.web3Service.solidityKeccak256(['uint256', 'uint256'], [seed.toString(), '1']);
      const d2 = Number(BigInt(hash2) % 6n);
      steps.push({
        stepIndex: 2,
        label: 'Xúc xắc 2 — Băm với nonce "1"',
        inputSeed: this.shortHash(randomWord),
        inputSeedFull: randomWord,
        hashOutput: this.shortHash(hash2),
        hashOutputFull: hash2,
        poolSizeBefore: 6,
        indexChosen: d2,
        valueChosen: `keccak256(seed, "1") % 6 = ${d2} → ${bauCuaNames[d2]}`
      });

      const hash3 = this.web3Service.solidityKeccak256(['uint256', 'uint256'], [seed.toString(), '2']);
      const d3 = Number(BigInt(hash3) % 6n);
      steps.push({
        stepIndex: 3,
        label: 'Xúc xắc 3 — Băm với nonce "2"',
        inputSeed: this.shortHash(randomWord),
        inputSeedFull: randomWord,
        hashOutput: this.shortHash(hash3),
        hashOutputFull: hash3,
        poolSizeBefore: 6,
        indexChosen: d3,
        valueChosen: `keccak256(seed, "2") % 6 = ${d3} → ${bauCuaNames[d3]}`
      });

      this.hashSteps.set(steps);
      return;
    }
  }

  /**
   * Khởi tạo canvas cho các trò chơi ngẫu nhiên
   */

  /**
   * Cơ chế tự động truy vấn cập nhật trạng thái (Polling)
   */
  private startPolling() {
    if (this.pollingInterval) return;

    this.waitingTime.set(0);
    this.timerInterval = setInterval(() => {
      this.waitingTime.update(val => val + 1);
    }, 1000);

    this.pollingInterval = setInterval(async () => {
      const id = this.requestId();
      const data = await this.web3Service.getDrawSessionDetails(id, true);
      
      if (data) {
        this.sessionDetails.set(data);
        
        if (data.fulfilled) {
          const res = this.web3Service.calculateResultClientSide(
            data.drawType,
            data.param1,
            data.param2,
            data.randomWord,
            data.participants
          );
          this.clientResult.set(res);
          this.toastService.showToast('Bốc thăm hoàn tất! Số ngẫu nhiên đã được trả về.', 'success');
          this.stopPolling();
          
        }
      }
    }, 5000); // Polling mỗi 5 giây
  }

  private stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  public get skinType(): string {
    const details = this.sessionDetails();
    return details && details.skin ? details.skin : '';
  }

  public formatTimestamp(timestamp: number): string {
    if (!timestamp) return '—';
    return new Date(timestamp * 1000).toLocaleString();
  }

  public isWinnerIndex(idx: number): boolean {
    const details = this.sessionDetails();
    return details && details.result && Number(details.result) === idx;
  }

  public isWinnerIndexInMulti(idx: number): boolean {
    const details = this.sessionDetails();
    if (!details || !details.result) return false;
    const winnerIndices = details.result.split(',').map(Number);
    return winnerIndices.includes(idx);
  }

  ngOnDestroy() {
    this.stopPolling();
    if (this.raceAnimationFrameId) cancelAnimationFrame(this.raceAnimationFrameId);
    if (this.wheelAnimationFrameId) cancelAnimationFrame(this.wheelAnimationFrameId);
    if (this.plinkoAnimationFrameId) cancelAnimationFrame(this.plinkoAnimationFrameId);
    if (this.boxTimeoutId) clearTimeout(this.boxTimeoutId);
    if (this.bauCuaTimeoutId) clearTimeout(this.bauCuaTimeoutId);
    if (this.slotTimeoutId) clearTimeout(this.slotTimeoutId);
    if (this.oanTuTiTimeoutId) clearTimeout(this.oanTuTiTimeoutId);
    if (this.slotIntervalId) clearInterval(this.slotIntervalId);
    if (this.vietlottIntervalId) clearInterval(this.vietlottIntervalId);
    if (this.tarotTimeoutId) clearTimeout(this.tarotTimeoutId);
    if (this.bingoTimeoutId) clearTimeout(this.bingoTimeoutId);
    if (this.bingoIntervalId) clearInterval(this.bingoIntervalId);
  }

  public isNumberWinners(): boolean {
    const res = this.clientResult();
    if (!res || !res.winners || res.winners.length === 0) return false;
    return !isNaN(Number(res.winners[0]));
  }

  /**
   * Chức năng sao chép liên kết (Copy Link)
   */
  public copyShareLink() {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    this.toastService.showToast('Đã sao chép liên kết chia sẻ vào bộ nhớ tạm!', 'success');
  }

  /**
   * Chức năng sao chép kết quả (Copy Result) dạng text
   */
  public copyShareResult() {
    const details = this.sessionDetails();
    const result = this.clientResult();
    if (!details || !result) return;

    const eventName = details.eventName.split(' | ')[0];
    const typeName = this.getDrawTypeName(details.drawType, details.skin);
    let resultText = `🎉 [ProofRandom] Kết quả bốc thăm: "${eventName}"\n`;
    resultText += `📌 Chế độ: ${typeName}\n`;

    if (details.drawType === 3) {
      resultText += `🏆 Người chiến thắng:\n${result.winners.map((w: string, i: number) => `  ${i + 1}. ${w}`).join('\n')}\n`;
    } else if (details.drawType === 9) {
      resultText += `👥 Phân đội:\n`;
      result.teams.forEach((t: any) => {
        resultText += `  📦 ${t.name}: ${t.members.join(', ')}\n`;
      });
    } else {
      resultText += `🏆 Kết quả: ${result.winners[0] || details.result}\n`;
    }

    resultText += `🔗 Xác minh giao dịch tại: ${this.web3Service.explorerUrl()}/tx/${details.txHash}\n`;
    resultText += `🔑 Mã RequestID VRF: ${details.requestId}`;

    navigator.clipboard.writeText(resultText);
    this.toastService.showToast('Đã sao chép nội dung kết quả bốc thăm!', 'success');
  }

  /**
   * Mở hoặc đóng Popup QR Code
   */
  public toggleQrModal(show: boolean) {
    this.showQrModal.set(show);
  }

  /**
   * Lấy URL ảnh QR Code từ Google Charts API
   */
  public getQrImageUrl(): string {
    if (typeof window === 'undefined') return '';
    const url = encodeURIComponent(window.location.href);
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${url}&format=png&margin=10`;
  }

  /**
   * Chia sẻ mạng xã hội (X / Twitter)
   */
  public shareOnX() {
    if (typeof window === 'undefined') return;
    const details = this.sessionDetails();
    if (!details) return;

    const eventName = details.eventName.split(' | ')[0];
    const text = `Tôi vừa tạo phiên bốc thăm ngẫu nhiên minh bạch "${eventName}" trên ProofRandom bảo chứng bởi Chainlink VRF. Xem kết quả tại đây:`;
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`;
    window.open(shareUrl, '_blank');
  }

  /**
   * Chia sẻ mạng xã hội (Facebook)
   */
  public shareOnFacebook() {
    if (typeof window === 'undefined') return;
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`;
    window.open(shareUrl, '_blank');
  }

  /**
   * Xuất dữ liệu ra file JSON
   */
  public exportAsJSON() {
    const details = this.sessionDetails();
    const result = this.clientResult();
    if (!details) return;

    const exportData = {
      requestId: details.requestId,
      eventName: details.eventName.split(' | ')[0],
      description: details.eventName.split(' | ')[1] || '',
      drawType: details.drawType,
      drawTypeName: this.getDrawTypeName(details.drawType, details.skin),
      creator: details.creator,
      param1: details.param1,
      param2: details.param2,
      randomWord: details.randomWord,
      timestamp: details.timestamp,
      dateTime: new Date(details.timestamp * 1000).toLocaleString(),
      txHash: details.txHash,
      blockNumber: details.blockNumber,
      participants: details.participants,
      rawResultOnChain: details.result,
      processedResult: result
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `ProofRandom_${details.requestId}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    this.toastService.showToast('Đã xuất file JSON thành công!', 'success');
  }

  /**
   * Helper hiển thị tên loại bốc thăm
   */
  public getDrawTypeName(type: number, skin?: string): string {
    const skins: Record<string, string> = {
      LuckyWheel:  'Vòng quay may mắn',
      Racing:      'Đua xe ngẫu nhiên',
      MysteryBox:  'Hộp quà bí ẩn',
      BauCua:      'Bầu Cua Tôm Cá',
      ScratchCard: 'Vé số cào',
      Vietlott:    'Xổ số Vietlott',
      Plinko:      'Thả bóng Plinko',
      SlotMachine: 'Quay Slot Machine',
      CardDraw:    'Bốc bài tây',
      OanTuTi:     'Oản tù tì',
      Sequence:    'Thứ tự ngẫu nhiên',
      WhatToEat:   'Hôm nay ăn gì?',
      Tarot:       'Rút bài Tarot',
      Bingo:       'Quay số Bingo',
      Dice:        'Quay xúc xắc',
      RandomLetter:'Chữ cái ngẫu nhiên (A-Z)',
      CoinFlip:    'Lật đồng xu'
    };
    if (skin && skins[skin]) return skins[skin];
    const names: Record<number, string> = {
      1: "Quay số ngẫu nhiên",
      2: "Chọn 1 tên ngẫu nhiên",
      3: "Chọn nhiều người thắng",
      4: "Lật đồng xu",
      5: "Quay xúc xắc",
      6: "Chẵn / Lẻ",
      7: "Màu sắc ngẫu nhiên",
      8: "Chữ cái ngẫu nhiên (A-Z)",
      9: "Chia đội ngẫu nhiên"
    };
    return names[type] || "Chưa xác định";
  }

  // --- TRÒ CHƠI NGẪU NHIÊN: BIẾN TRẠNG THÁI & PHƯƠNG THỨC ---
  
  // 1. Vòng quay may mắn (Lucky Wheel)
  public readonly isWheelSpinning = signal<boolean>(false);
  public readonly wheelSpinDone = signal<boolean>(false);
  
  public initWheelCanvas() {
    setTimeout(() => {
      const canvas = document.getElementById('wheelCanvas') as HTMLCanvasElement;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const details = this.sessionDetails();
      if (!details || !details.participants) return;
      
      const participants = details.participants;
      const numSegments = participants.length;
      const anglePerSeg = (2 * Math.PI) / numSegments;
      
      // Nếu đã quay xong, xoay vòng quay đến người chiến thắng
      let startAngle = 0;
      if (this.wheelSpinDone() && details.result !== undefined && details.result !== null && details.result !== '') {
        const winnerIdx = Number(details.result);
        startAngle = (2 * Math.PI) - (winnerIdx * anglePerSeg + anglePerSeg / 2) - (Math.PI / 2);
      }
      
      ctx.save();
      ctx.clearRect(0, 0, 300, 300);
      ctx.translate(150, 150);
      ctx.rotate(startAngle);
      ctx.translate(-150, -150);
      
      const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
      for (let i = 0; i < numSegments; i++) {
        ctx.beginPath();
        ctx.moveTo(150, 150);
        ctx.arc(150, 150, 140, i * anglePerSeg, (i + 1) * anglePerSeg);
        ctx.closePath();
        
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 0, 221, 0.15)' : 'rgba(128, 0, 255, 0.15)';
        ctx.strokeStyle = 'rgba(255, 0, 221, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();
        
        ctx.save();
        ctx.translate(150, 150);
        ctx.rotate(i * anglePerSeg + anglePerSeg / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = isDark ? '#cbd5e1' : '#334155';
        ctx.font = 'bold 11px Quicksand, sans-serif';
        const displayName = participants[i].length > 12 ? participants[i].substring(0, 10) + '..' : participants[i];
        ctx.fillText(displayName, 130, 4);
        ctx.restore();
      }
      ctx.restore();
    }, 100);
  }
  
  public spinWheel() {
    if (this.isWheelSpinning() || this.wheelSpinDone()) return;
    this.isWheelSpinning.set(true);
    
    const details = this.sessionDetails();
    if (!details || !details.result) return;
    const winnerIdx = Number(details.result);
    const numSegments = details.participants.length;
    
    const canvas = document.getElementById('wheelCanvas') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const anglePerSeg = (2 * Math.PI) / numSegments;
    const targetAngle = (2 * Math.PI) - (winnerIdx * anglePerSeg + anglePerSeg / 2) - (Math.PI / 2);
    
    // Thêm 8 vòng xoay đầy để tăng độ kịch tính
    const totalRotation = targetAngle + 16 * Math.PI;
    
    let startTimestamp: number | null = null;
    const duration = 5000; // 5s
    
    const animate = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);
      
      const easeProgress = 1 - Math.pow(1 - progress, 3); // cubic ease out
      const currentAngle = easeProgress * totalRotation;
      
      ctx.save();
      ctx.clearRect(0, 0, 300, 300);
      ctx.translate(150, 150);
      ctx.rotate(currentAngle);
      ctx.translate(-150, -150);
      
      const participants = details.participants;
      for (let i = 0; i < numSegments; i++) {
        ctx.beginPath();
        ctx.moveTo(150, 150);
        ctx.arc(150, 150, 140, i * anglePerSeg, (i + 1) * anglePerSeg);
        ctx.closePath();
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 0, 221, 0.15)' : 'rgba(128, 0, 255, 0.15)';
        ctx.strokeStyle = 'rgba(255, 0, 221, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();
        
        ctx.save();
        ctx.translate(150, 150);
        ctx.rotate(i * anglePerSeg + anglePerSeg / 2);
        ctx.textAlign = 'right';
        const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
        ctx.fillStyle = isDark ? '#cbd5e1' : '#334155';
        ctx.font = 'bold 11px Quicksand, sans-serif';
        const displayName = participants[i].length > 12 ? participants[i].substring(0, 10) + '..' : participants[i];
        ctx.fillText(displayName, 130, 4);
        ctx.restore();
      }
      ctx.restore();
      
      if (progress < 1) {
        this.wheelAnimationFrameId = requestAnimationFrame(animate);
      } else {
        this.isWheelSpinning.set(false);
        this.wheelSpinDone.set(true);
        this.toastService.showToast(`Chúc mừng ${this.clientResult().winners[0]} đã chiến thắng!`, 'success');
      }
    };
    
    this.wheelAnimationFrameId = requestAnimationFrame(animate);
  }

  // 2. Đua xe ngẫu nhiên (Random Racing)
  public readonly isRacing = signal<boolean>(false);
  public readonly raceDone = signal<boolean>(false);
  public readonly racerProgresses = signal<number[]>([]);

  // --- TRÒ CHƠI NGẪU NHIÊN: ĐĂNG KÝ SIGNALS CHO 4 GAME MỚI ---
  public readonly isPlinkoRunning = signal<boolean>(false);
  public readonly plinkoDone = signal<boolean>(false);
  
  public readonly isSlotSpinning = signal<boolean>(false);
  public readonly slotDone = signal<boolean>(false);
  public readonly slotReels = signal<string[][]>([[], [], []]);
  public readonly slotCurrentIndices = signal<number[]>([0, 0, 0]);

  public readonly isCardShuffling = signal<boolean>(false);
  public readonly cardDone = signal<boolean>(false);
  public readonly cards = signal<any[]>([]);
  public readonly pickedCardIdx = signal<number | null>(null);

  public readonly isOanTuTiRunning = signal<boolean>(false);
  public readonly oanTuTiDone = signal<boolean>(false);
  public readonly playerHand = signal<string>('rock');
  public readonly cpuHand = signal<string>('rock');
  public readonly oanTuTiResultText = signal<string>('');

  // --- TRÒ CHƠI NGẪU NHIÊN: ĐĂNG KÝ SIGNALS CHO 3 CHẾ ĐỘ MỚI ---
  public readonly isSequenceRunning = signal<boolean>(false);
  public readonly sequenceDone = signal<boolean>(false);
  public readonly shuffledQueue = signal<string[]>([]);

  public readonly isSeatingRunning = signal<boolean>(false);
  public readonly seatingDone = signal<boolean>(false);
  public readonly seatingLayout = signal<string[][]>([]);
  public readonly seatingCols = signal<number>(4);

  public readonly isFoodOpening = signal<boolean>(false);
  public readonly foodOpened = signal<boolean>(false);

  // 14. Rút bài Tarot (Tarot Card Reader)
  public readonly isTarotRunning = signal<boolean>(false);
  public readonly tarotDone = signal<boolean>(false);
  public readonly tarotCards = signal<any[]>([]);
  public readonly tarotSelectedIdx = signal<number | null>(null);

  // 15. Quay số Bingo (Bingo Caller)
  public readonly isBingoRunning = signal<boolean>(false);
  public readonly bingoDone = signal<boolean>(false);
  public readonly bingoNumber = signal<number | null>(null);
  public readonly bingoNumbers = signal<number[]>([]);
  public readonly bingoBallList = signal<number[]>([]);

  private markAnimationsAsDone() {
    this.wheelSpinDone.set(true);
    this.raceDone.set(true);
    this.boxOpened.set(true);
    this.bauCuaOpened.set(true);
    this.scratchDone.set(true);
    this.vietlottDone.set(true);
    this.plinkoDone.set(true);
    this.slotDone.set(true);
    this.cardDone.set(true);
    this.oanTuTiDone.set(true);
    this.sequenceDone.set(true);
    this.seatingDone.set(true);
    this.foodOpened.set(true);
    this.tarotDone.set(true);
    this.bingoDone.set(true);
    
    // Thiết lập kết quả Vietlott
    const type = this.selectedVietlottType();
    const resultObj = this.getVietlottResults(type);
    this.vietlottNumbers.set(resultObj.numbers);
    if (type === 'Power655') {
      this.vietlottBonus.set(resultObj.bonus || null);
    }
    const totalBalls = type === 'Keno' ? 20 : (type === 'Power655' ? 7 : 6);
    this.revealedCount.set(totalBalls);
    
    const details = this.sessionDetails();
    if (details && details.participants && details.result !== undefined && details.result !== null && details.result !== '') {
      const count = details.participants.length;
      const winnerIdx = Number(details.result);
      
      // Đồng bộ Racing
      const current = new Array(count).fill(50);
      current[winnerIdx] = 100;
      this.racerProgresses.set(current);
      
      // Đồng bộ Slot Machine
      const winnerName = details.participants[winnerIdx] || 'Người thắng';
      this.slotReels.set([[winnerName], [winnerName], [winnerName]]);
      this.slotCurrentIndices.set([0, 0, 0]);

      // Đồng bộ Bốc bài tây
      this.pickedCardIdx.set(0);
      const cardsList = [{ name: winnerName, isWinner: true, flipped: true }];
      // Thêm các thẻ bài trượt giả
      const participantsList = Array.from(details.participants || []) as string[];
      const others = participantsList.filter((p: string, idx: number) => idx !== winnerIdx).slice(0, 4);
      others.forEach((p: string) => {
        cardsList.push({ name: p, isWinner: false, flipped: true });
      });
      this.cards.set(cardsList);

      // Đồng bộ Oản tù tì
      if (details.drawType === 1) {
        const seedVal = BigInt(details.randomWord);
        const playerMod = Number(seedVal % 3n);
        const cpuMod = Number((seedVal / 3n) % 3n);
        const hands = ['scissors', 'rock', 'paper'];
        const handsVN = ['Kéo', 'Búa', 'Bao'];
        this.playerHand.set(hands[playerMod]);
        this.cpuHand.set(hands[cpuMod]);
        const winnerName = this.clientResult()?.winners[0] || 'Người chơi';
        
        let winnerText = '';
        if (playerMod === cpuMod) {
          winnerText = `Người chơi "${winnerName}" (${handsVN[playerMod]}) HÒA Máy (${handsVN[cpuMod]})`;
        } else if ((playerMod === 0 && cpuMod === 2) || (playerMod === 1 && cpuMod === 0) || (playerMod === 2 && cpuMod === 1)) {
          winnerText = `Người chơi "${winnerName}" (${handsVN[playerMod]}) CHIẾN THẮNG Máy (${handsVN[cpuMod]})`;
        } else {
          winnerText = `Máy (${handsVN[cpuMod]}) CHIẾN THẮNG Người chơi "${winnerName}" (${handsVN[playerMod]})`;
        }
        this.oanTuTiResultText.set(winnerText);
      }

      // Đồng bộ Sequence (Hàng đợi)
      if (details.skin === 'Sequence') {
        const res = this.clientResult();
        if (res && res.winners) {
          this.shuffledQueue.set(res.winners);
        }
      }

      // Đồng bộ Seating (Sơ đồ chỗ ngồi)
      if (details.skin && details.skin.startsWith('Seating')) {
        const res = this.clientResult();
        if (res && res.winners) {
          const cols = parseInt(details.skin.split('-')[1]) || 4;
          this.seatingCols.set(cols);
          
          const layout: string[][] = [];
          const winners = res.winners;
          for (let i = 0; i < winners.length; i += cols) {
            layout.push(winners.slice(i, i + cols));
          }
          this.seatingLayout.set(layout);
        }
      }

      // Đồng bộ Tarot
      if (details.skin === 'Tarot') {
        const wName = details.participants[winnerIdx] || 'The Sun (Mặt Trời)';
        const allTarotList = [
          'The Fool (Chàng Khờ)', 'The Magician (Nhà Ảo Thuật)', 'The High Priestess (Nữ Tư Tế)',
          'The Empress (Nữ Hoàng)', 'The Emperor (Hoàng Đế)', 'The Hierophant (Giáo Hoàng)',
          'The Lovers (Tình Nhân)', 'The Chariot (Chiến Xa)', 'Strength (Sức Mạnh)',
          'The Hermit (Ẩn Sĩ)', 'Wheel of Fortune (Vòng Quay Số Phận)', 'Justice (Công Lý)',
          'The Hanged Man (Kẻ Treo)', 'Death (Tử Thần)', 'Temperance (Tiết Độ)',
          'The Devil (Ác Quỷ)', 'The Tower (Tòa Tháp)', 'The Star (Ngôi Sao)',
          'The Moon (Mặt Trăng)', 'The Sun (Mặt Trời)', 'Judgement (Phán Xét)', 'The World (Thế Giới)'
        ];
        const fakes = allTarotList.filter(c => c !== wName);
        const fake1 = fakes[Number(BigInt(details.randomWord || 0) % BigInt(fakes.length))];
        const fakes2 = fakes.filter(c => c !== fake1);
        const fake2 = fakes2[Number((BigInt(details.randomWord || 0) / 2n) % BigInt(fakes2.length))];
        const winPos = Number(BigInt(details.randomWord || 0) % 3n);
        
        const cardsList = new Array(3);
        cardsList[winPos] = { name: wName, isWinner: true, flipped: true, selected: true, desc: this.getTarotDesc(wName) };
        let fakeIdx = 0;
        const fakeArr = [fake1, fake2];
        for (let i = 0; i < 3; i++) {
          if (i !== winPos) {
            const fakeName = fakeArr[fakeIdx++];
            cardsList[i] = { name: fakeName, isWinner: false, flipped: true, selected: false, desc: this.getTarotDesc(fakeName) };
          }
        }
        this.tarotCards.set(cardsList);
        this.tarotDone.set(true);
      }

      // Đồng bộ Bingo
      if (details.skin === 'Bingo') {
        const results = this.getBingoResults();
        this.bingoNumbers.set(results);
        if (results.length > 0) {
          this.bingoNumber.set(results[results.length - 1]);
        }
        this.bingoDone.set(true);
      }
    }
  }

  private initRacingProgress() {
    const details = this.sessionDetails();
    if (details && details.participants && this.skinType === 'Racing') {
      this.racerProgresses.set(new Array(details.participants.length).fill(0));
    }
  }
  
  public startRace() {
    if (this.isRacing() || this.raceDone()) return;
    this.isRacing.set(true);
    
    const details = this.sessionDetails();
    if (!details || !details.participants) return;
    
    const count = details.participants.length;
    this.racerProgresses.set(new Array(count).fill(0));
    const winnerIdx = Number(details.result);
    
    const duration = 5000;
    let startTimestamp: number | null = null;
    
    const animate = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);
      
      const current = new Array(count);
      for (let i = 0; i < count; i++) {
        if (i === winnerIdx) {
          current[i] = progress * 100;
        } else {
          // Các xe khác chạy loạng choạng và kẹt ở tối đa 88%
          const wave = Math.sin(progress * Math.PI * 2 + i) * 6;
          current[i] = Math.min(progress * 80 + wave, 88);
        }
      }
      this.racerProgresses.set(current);
      
      if (progress < 1) {
        this.raceAnimationFrameId = requestAnimationFrame(animate);
      } else {
        this.isRacing.set(false);
        this.raceDone.set(true);
        this.toastService.showToast(`Chúc mừng ${this.clientResult().winners[0]} đã về đích đầu tiên!`, 'success');
      }
    };
    this.raceAnimationFrameId = requestAnimationFrame(animate);
  }

  // 3. Hộp quà bí ẩn (Mystery Box)
  public readonly isBoxOpening = signal<boolean>(false);
  public readonly boxOpened = signal<boolean>(false);
  
  public openBox() {
    if (this.isBoxOpening() || this.boxOpened()) return;
    this.isBoxOpening.set(true);
    
    this.boxTimeoutId = setTimeout(() => {
      this.isBoxOpening.set(false);
      this.boxOpened.set(true);
      this.toastService.showToast(`Hộp quà đã mở! Chúc mừng: ${this.clientResult().winners[0]}`, 'success');
    }, 2000);
  }

  // 4. Bầu Cua Tôm Cá (Bau Cua)
  public readonly isBauCuaShaking = signal<boolean>(false);
  public readonly bauCuaOpened = signal<boolean>(false);
  public bauCuaResultDice: number[] = [0, 0, 0];
  public readonly bauCuaItems = [
    { icon: '', name: 'Bầu' },
    { icon: '', name: 'Cua' },
    { icon: '', name: 'Tôm' },
    { icon: '', name: 'Cá' },
    { icon: '', name: 'Gà' },
    { icon: '', name: 'Nai' }
  ];

  public shakeBauCua() {
    if (this.isBauCuaShaking() || this.bauCuaOpened()) return;
    this.isBauCuaShaking.set(true);
    
    const details = this.sessionDetails();
    if (!details || !details.randomWord) return;
    
    const seed = BigInt(details.randomWord);
    const d1 = Number(seed % 6n);
    const hash2 = this.web3Service.solidityKeccak256(['uint256', 'uint256'], [seed.toString(), '1']);
    const d2 = Number(BigInt(hash2) % 6n);
    const hash3 = this.web3Service.solidityKeccak256(['uint256', 'uint256'], [seed.toString(), '2']);
    const d3 = Number(BigInt(hash3) % 6n);
    
    this.bauCuaResultDice = [d1, d2, d3];
    
    this.bauCuaTimeoutId = setTimeout(() => {
      this.isBauCuaShaking.set(false);
      this.bauCuaOpened.set(true);
      const winnersText = this.bauCuaResultDice.map(i => this.bauCuaItems[i].name).join(' - ');
      this.toastService.showToast(`Kết quả Bầu Cua: ${winnersText}`, 'success');
    }, 2000);
  }

  public skipRace() {
    if (this.raceAnimationFrameId) {
      cancelAnimationFrame(this.raceAnimationFrameId);
      this.raceAnimationFrameId = null;
    }
    
    const details = this.sessionDetails();
    if (!details || !details.participants) return;
    
    const count = details.participants.length;
    const winnerIdx = Number(details.result);
    
    const current = new Array(count).fill(50);
    current[winnerIdx] = 100;
    this.racerProgresses.set(current);
    
    this.isRacing.set(false);
    this.raceDone.set(true);
    this.toastService.showToast(`Chúc mừng ${this.clientResult().winners[0]} đã về đích đầu tiên!`, 'success');
  }

  public skipWheel() {
    if (this.wheelAnimationFrameId) {
      cancelAnimationFrame(this.wheelAnimationFrameId);
      this.wheelAnimationFrameId = null;
    }
    
    const details = this.sessionDetails();
    if (!details || !details.result) return;
    
    const winnerIdx = Number(details.result);
    const numSegments = details.participants.length;
    const anglePerSeg = (2 * Math.PI) / numSegments;
    const targetAngle = (2 * Math.PI) - (winnerIdx * anglePerSeg + anglePerSeg / 2) - (Math.PI / 2);
    
    const canvas = document.getElementById('wheelCanvas') as HTMLCanvasElement;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.save();
        ctx.clearRect(0, 0, 300, 300);
        ctx.translate(150, 150);
        ctx.rotate(targetAngle);
        ctx.translate(-150, -150);
        
        const participants = details.participants;
        const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
        for (let i = 0; i < numSegments; i++) {
          ctx.beginPath();
          ctx.moveTo(150, 150);
          ctx.arc(150, 150, 140, i * anglePerSeg, (i + 1) * anglePerSeg);
          ctx.closePath();
          ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 0, 221, 0.15)' : 'rgba(128, 0, 255, 0.15)';
          ctx.strokeStyle = 'rgba(255, 0, 221, 0.3)';
          ctx.lineWidth = 1.5;
          ctx.fill();
          ctx.stroke();
          
          ctx.save();
          ctx.translate(150, 150);
          ctx.rotate(i * anglePerSeg + anglePerSeg / 2);
          ctx.textAlign = 'right';
          ctx.fillStyle = isDark ? '#cbd5e1' : '#334155';
          ctx.font = 'bold 11px Quicksand, sans-serif';
          const displayName = participants[i].length > 12 ? participants[i].substring(0, 10) + '..' : participants[i];
          ctx.fillText(displayName, 130, 4);
          ctx.restore();
        }
        ctx.restore();
      }
    }
    
    this.isWheelSpinning.set(false);
    this.wheelSpinDone.set(true);
    this.toastService.showToast(`Chúc mừng ${this.clientResult().winners[0]} đã chiến thắng!`, 'success');
  }

  public skipBox() {
    if (this.boxTimeoutId) {
      clearTimeout(this.boxTimeoutId);
      this.boxTimeoutId = null;
    }
    this.isBoxOpening.set(false);
    this.boxOpened.set(true);
    this.toastService.showToast(`Hộp quà đã mở! Chúc mừng: ${this.clientResult().winners[0]}`, 'success');
  }

  public skipBauCua() {
    if (this.bauCuaTimeoutId) {
      clearTimeout(this.bauCuaTimeoutId);
      this.bauCuaTimeoutId = null;
    }
    
    const details = this.sessionDetails();
    if (!details || !details.randomWord) return;
    
    const seed = BigInt(details.randomWord);
    const d1 = Number(seed % 6n);
    const hash2 = this.web3Service.solidityKeccak256(['uint256', 'uint256'], [seed.toString(), '1']);
    const d2 = Number(BigInt(hash2) % 6n);
    const hash3 = this.web3Service.solidityKeccak256(['uint256', 'uint256'], [seed.toString(), '2']);
    const d3 = Number(BigInt(hash3) % 6n);
    
    this.bauCuaResultDice = [d1, d2, d3];
    this.isBauCuaShaking.set(false);
    this.bauCuaOpened.set(true);
    const winnersText = this.bauCuaResultDice.map(i => this.bauCuaItems[i].name).join(' - ');
    this.toastService.showToast(`Kết quả Bầu Cua: ${winnersText}`, 'success');
  }

  // 5. Vé số cào (Scratch Card)
  public readonly isScratched = signal<boolean>(false);
  public readonly scratchDone = signal<boolean>(false);
  
  public initScratchCard() {
    setTimeout(() => {
      const canvas = document.getElementById('scratchCanvas') as HTMLCanvasElement;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
      const grad = ctx.createLinearGradient(0, 0, 240, 120);
      if (isDark) {
        grad.addColorStop(0, '#1e293b');
        grad.addColorStop(1, '#334155');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 240, 120);
        
        ctx.font = 'bold 11px Quicksand, sans-serif';
        ctx.fillStyle = '#94a3b8';
      } else {
        grad.addColorStop(0, '#f1f5f9');
        grad.addColorStop(1, '#cbd5e1');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 240, 120);
        
        ctx.font = 'bold 11px Quicksand, sans-serif';
        ctx.fillStyle = '#475569';
      }
      ctx.textAlign = 'center';
      ctx.fillText('DI CHUỘT CÀO LỚP BẠC', 120, 65);
      
      let isDrawing = false;
      const scratch = (x: number, y: number) => {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(x, y, 16, 0, Math.PI * 2);
        ctx.fill();
      };
      
      const getPos = (e: MouseEvent | TouchEvent) => {
        const rect = canvas.getBoundingClientRect();
        if (e instanceof MouseEvent) {
          return { x: e.clientX - rect.left, y: e.clientY - rect.top };
        } else {
          return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
        }
      };
      
      canvas.onmousedown = () => isDrawing = true;
      canvas.onmouseup = () => isDrawing = false;
      canvas.onmousemove = (e) => {
        if (!isDrawing) return;
        const pos = getPos(e);
        scratch(pos.x, pos.y);
        this.isScratched.set(true);
      };
      
      canvas.ontouchstart = () => isDrawing = true;
      canvas.ontouchend = () => isDrawing = false;
      canvas.ontouchmove = (e) => {
        e.preventDefault();
        if (!isDrawing) return;
        const pos = getPos(e);
        scratch(pos.x, pos.y);
        this.isScratched.set(true);
      };
    }, 100);
  }
  
  public autoScratch() {
    this.isScratched.set(true);
    this.scratchDone.set(true);
    const canvas = document.getElementById('scratchCanvas') as HTMLCanvasElement;
    if (canvas) {
      canvas.style.opacity = '0';
      setTimeout(() => canvas.style.display = 'none', 300);
    }
  }

  // 6. Xổ số Vietlott (Vietlott Lottery)
  public readonly selectedVietlottType = signal<'Power655' | 'Mega645' | 'Keno'>('Power655');
  public readonly isVietlottDrawing = signal<boolean>(false);
  public readonly vietlottDone = signal<boolean>(false);
  public readonly vietlottNumbers = signal<number[]>([]);
  public readonly vietlottBonus = signal<number | null>(null);
  public readonly revealedCount = signal<number>(0);
  public readonly currentSpinningNumber = signal<number>(0);

  public getVietlottResults(type: string): { numbers: number[], bonus?: number } {
    const details = this.sessionDetails();
    if (!details || !details.randomWord || details.randomWord === '0') {
      return { numbers: [] };
    }
    
    const seed = details.randomWord;
    
    if (type === 'Mega645') {
      const pool = Array.from({ length: 45 }, (_, i) => i + 1);
      const results: number[] = [];
      let currentSeed = seed;
      
      for (let i = 0; i < 6; i++) {
        const hash = this.web3Service.solidityKeccak256(['uint256', 'string'], [currentSeed, `Mega645_${i}`]);
        const randIdx = Number(BigInt(hash) % BigInt(pool.length));
        results.push(pool.splice(randIdx, 1)[0]);
        currentSeed = hash;
      }
      results.sort((a, b) => a - b);
      return { numbers: results };
      
    } else if (type === 'Power655') {
      const pool = Array.from({ length: 55 }, (_, i) => i + 1);
      const results: number[] = [];
      let currentSeed = seed;
      
      for (let i = 0; i < 6; i++) {
        const hash = this.web3Service.solidityKeccak256(['uint256', 'string'], [currentSeed, `Power655_${i}`]);
        const randIdx = Number(BigInt(hash) % BigInt(pool.length));
        results.push(pool.splice(randIdx, 1)[0]);
        currentSeed = hash;
      }
      results.sort((a, b) => a - b);
      
      const bonusHash = this.web3Service.solidityKeccak256(['uint256', 'string'], [currentSeed, 'Power655_Bonus']);
      const bonusIdx = Number(BigInt(bonusHash) % BigInt(pool.length));
      const bonus = pool[bonusIdx];
      
      return { numbers: results, bonus };
      
    } else { // Keno
      const pool = Array.from({ length: 80 }, (_, i) => i + 1);
      const results: number[] = [];
      let currentSeed = seed;
      
      for (let i = 0; i < 20; i++) {
        const hash = this.web3Service.solidityKeccak256(['uint256', 'string'], [currentSeed, `Keno_${i}`]);
        const randIdx = Number(BigInt(hash) % BigInt(pool.length));
        results.push(pool.splice(randIdx, 1)[0]);
        currentSeed = hash;
      }
      results.sort((a, b) => a - b);
      return { numbers: results };
    }
  }

  public selectVietlottType(type: 'Power655' | 'Mega645' | 'Keno') {
    if (this.isVietlottDrawing()) return;
    this.selectedVietlottType.set(type);
    this.resetVietlottState();
  }

  public resetVietlottState() {
    if (this.vietlottIntervalId) {
      clearInterval(this.vietlottIntervalId);
      this.vietlottIntervalId = null;
    }
    this.vietlottNumbers.set([]);
    this.vietlottBonus.set(null);
    this.revealedCount.set(0);
    this.isVietlottDrawing.set(false);
    this.vietlottDone.set(false);
  }

  public startVietlottDraw() {
    if (this.isVietlottDrawing() || this.vietlottDone()) return;
    
    this.resetVietlottState();
    this.isVietlottDrawing.set(true);
    
    const type = this.selectedVietlottType();
    const resultObj = this.getVietlottResults(type);
    
    const totalBalls = type === 'Keno' ? 20 : (type === 'Power655' ? 7 : 6);
    const maxVal = type === 'Keno' ? 80 : (type === 'Power655' ? 55 : 45);
    
    const finalNumbers = resultObj.numbers;
    const bonusVal = resultObj.bonus || null;
    
    let spinTimer = setInterval(() => {
      this.currentSpinningNumber.set(Math.floor(Math.random() * maxVal) + 1);
    }, 50);
    
    this.vietlottIntervalId = setInterval(() => {
      const currentRevealed = this.revealedCount();
      
      if (currentRevealed < totalBalls) {
        let numChot = 0;
        if (type === 'Power655' && currentRevealed === 6) {
          numChot = bonusVal!;
          this.vietlottBonus.set(bonusVal);
        } else {
          numChot = finalNumbers[currentRevealed];
          this.vietlottNumbers.update(arr => [...arr, numChot]);
        }
        
        this.revealedCount.set(currentRevealed + 1);
        
        if (this.revealedCount() === totalBalls) {
          clearInterval(this.vietlottIntervalId);
          clearInterval(spinTimer);
          this.vietlottIntervalId = null;
          this.isVietlottDrawing.set(false);
          this.vietlottDone.set(true);
          
          const textWin = type === 'Keno' 
            ? 'Bảng số Keno đã được chốt!'
            : (type === 'Power655' 
                ? `Chúc mừng bạn đã quay được bộ số Power 6/55: ${finalNumbers.join(', ')} | Số phụ: ${bonusVal}`
                : `Chúc mừng bạn đã quay được bộ số Mega 6/45: ${finalNumbers.join(', ')}`);
          this.toastService.showToast(textWin, 'success');
        }
      }
    }, 900);
  }

  public skipVietlott() {
    if (this.vietlottIntervalId) {
      clearInterval(this.vietlottIntervalId);
      this.vietlottIntervalId = null;
    }
    
    const type = this.selectedVietlottType();
    const resultObj = this.getVietlottResults(type);
    
    this.vietlottNumbers.set(resultObj.numbers);
    if (type === 'Power655') {
      this.vietlottBonus.set(resultObj.bonus || null);
    } else {
      this.vietlottBonus.set(null);
    }
    
    const totalBalls = type === 'Keno' ? 20 : (type === 'Power655' ? 7 : 6);
    this.revealedCount.set(totalBalls);
    this.isVietlottDrawing.set(false);
    this.vietlottDone.set(true);
    
    const textWin = type === 'Keno' 
      ? 'Bảng số Keno đã được chốt!'
      : (type === 'Power655' 
          ? `Bộ số Power 6/55: ${resultObj.numbers.join(', ')} | Số phụ: ${resultObj.bonus}`
          : `Bộ số Mega 6/45: ${resultObj.numbers.join(', ')}`);
    this.toastService.showToast(textWin, 'success');
  }

  // ================= 7. PLINKO BOARD MAY MẮN =================
  public initPlinkoCanvas() {
    setTimeout(() => {
      const canvas = document.getElementById('plinkoCanvas') as HTMLCanvasElement;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      this.drawPlinkoBoard(ctx, canvas.width, canvas.height, 12, null, null);
    }, 100);
  }

  private drawPlinkoBoard(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    rows: number,
    ballX: number | null,
    ballY: number | null
  ) {
    ctx.clearRect(0, 0, width, height);
    
    // Background tối giản sang trọng
    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    ctx.fillStyle = isDark ? '#020617' : '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    // Vẽ lưới đinh tam giác (peg board)
    ctx.fillStyle = isDark ? '#475569' : '#cbd5e1';
    const startY = 40;
    const rowSpacing = (height - 80) / rows;
    
    for (let r = 0; r < rows; r++) {
      const pinsInRow = r + 3;
      const rowWidth = pinsInRow * 20;
      const startX = (width - rowWidth) / 2 + 10;
      for (let p = 0; p < pinsInRow; p++) {
        ctx.beginPath();
        ctx.arc(startX + p * 20, startY + r * rowSpacing, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Vẽ quả bóng Plinko màu hồng Neon
    if (ballX !== null && ballY !== null) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(ballX, ballY, 7.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ff00dd';
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#ff00dd';
      ctx.fill();
      ctx.restore();
    } else {
      // Vẽ bóng ở vị trí thả mặc định
      ctx.beginPath();
      ctx.arc(width / 2, 20, 7.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ff00dd';
      ctx.fill();
    }

    // Vẽ các khe ở đáy bảng Plinko
    const details = this.sessionDetails();
    if (details && details.participants) {
      const participantsList = Array.from(details.participants || []) as string[];
      const count = participantsList.length;
      const winnerIdx = Number(details.result);
      const winnerName = participantsList[winnerIdx] || 'Winner';

      let totalBins = 9;
      let targetBinIdx = 4;
      
      if (count <= 9) {
        totalBins = count;
        targetBinIdx = winnerIdx;
      } else {
        totalBins = 9;
        targetBinIdx = 4;
      }
      
      const binNames = new Array(totalBins).fill('');
      if (count <= 9) {
        for (let i = 0; i < count; i++) {
          binNames[i] = participantsList[i];
        }
      } else {
        binNames[targetBinIdx] = winnerName;
        let othersIdx = 0;
        const others = participantsList.filter((p: string) => p !== winnerName);
        for (let b = 0; b < totalBins; b++) {
          if (b !== targetBinIdx) {
            binNames[b] = others[othersIdx] || '';
            othersIdx++;
          }
        }
      }

      const binWidth = width / totalBins;
      ctx.fillStyle = isDark ? '#0f172a' : '#e2e8f0';
      ctx.strokeStyle = isDark ? '#1e293b' : '#cbd5e1';
      ctx.lineWidth = 1;
      
      ctx.font = 'bold 9px Quicksand, sans-serif';
      ctx.textAlign = 'center';

      for (let b = 0; b < totalBins; b++) {
        const x = b * binWidth;
        // Vẽ vách ngăn khe
        ctx.beginPath();
        ctx.moveTo(x, height - 30);
        ctx.lineTo(x, height);
        ctx.stroke();

        // Vẽ chữ kết quả
        const name = binNames[b] || '';
        const displayName = name.length > 8 ? name.substring(0, 6) + '..' : name;
        ctx.fillStyle = b === targetBinIdx ? '#ff00dd' : '#64748b';
        ctx.fillText(displayName, x + binWidth / 2, height - 10);
      }
    }
  }

  public startPlinko() {
    if (this.isPlinkoRunning() || this.plinkoDone()) return;
    this.isPlinkoRunning.set(true);

    const canvas = document.getElementById('plinkoCanvas') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const rows = 12;

    const details = this.sessionDetails();
    if (!details || !details.participants) return;

    const participantsList = Array.from(details.participants || []) as string[];
    const count = participantsList.length;
    const winnerIdx = Number(details.result);

    let totalBins = 9;
    let targetBinIdx = 4;

    if (count <= 9) {
      totalBins = count;
      targetBinIdx = winnerIdx;
    } else {
      totalBins = 9;
      targetBinIdx = 4;
    }

    const binWidth = width / totalBins;
    const targetX = targetBinIdx * binWidth + binWidth / 2;

    let currentX = width / 2;
    let currentY = 20;
    let vy = 2.5;

    const animate = () => {
      currentY += vy;

      // Nảy ngang nhẹ theo lực hút kéo dần về trục đích
      const distanceToBottom = height - 30 - currentY;
      if (distanceToBottom > 20) {
        const dx = targetX - currentX;
        const drift = dx / (distanceToBottom / 5.5);
        currentX += drift + (Math.random() - 0.5) * 2;
      } else {
        const dx = targetX - currentX;
        currentX += dx * 0.2;
      }

      this.drawPlinkoBoard(ctx, width, height, rows, currentX, currentY);

      if (currentY < height - 20) {
        this.plinkoAnimationFrameId = requestAnimationFrame(animate);
      } else {
        this.isPlinkoRunning.set(false);
        this.plinkoDone.set(true);
        this.toastService.showToast(`Chúc mừng ${participantsList[winnerIdx]} đã chiến thắng Plinko!`, 'success');
      }
    };

    this.plinkoAnimationFrameId = requestAnimationFrame(animate);
  }

  public skipPlinko() {
    if (this.plinkoAnimationFrameId) {
      cancelAnimationFrame(this.plinkoAnimationFrameId);
      this.plinkoAnimationFrameId = null;
    }
    this.isPlinkoRunning.set(false);
    this.plinkoDone.set(true);
    this.initPlinkoCanvas();
    this.toastService.showToast(`Chúc mừng ${this.clientResult().winners[0]} đã chiến thắng Plinko!`, 'success');
  }

  // ================= 8. SLOT MACHINE MAY MẮN =================
  public initSlotMachine() {
    const details = this.sessionDetails();
    if (!details || !details.participants) return;
    const winnerIdx = Number(details.result);
    const winnerName = details.participants[winnerIdx] || 'Winner';
    
    const reels: string[][] = [[], [], []];
    for (let r = 0; r < 3; r++) {
      const shuffled = [...details.participants].sort(() => Math.random() - 0.5);
      reels[r] = [...shuffled, winnerName];
    }
    this.slotReels.set(reels);
    this.slotCurrentIndices.set([0, 0, 0]);
    this.slotDone.set(false);
    this.isSlotSpinning.set(false);
  }

  public startSlot() {
    if (this.isSlotSpinning() || this.slotDone()) return;
    this.isSlotSpinning.set(true);

    const reels = this.slotReels();
    let speed1 = true;
    let speed2 = true;
    let speed3 = true;

    this.slotIntervalId = setInterval(() => {
      this.slotCurrentIndices.update(curr => {
        const next = [...curr];
        if (speed1) next[0] = (next[0] + 1) % reels[0].length;
        if (speed2) next[1] = (next[1] + 1) % reels[1].length;
        if (speed3) next[2] = (next[2] + 1) % reels[2].length;
        return next;
      });
    }, 85);

    this.slotTimeoutId = setTimeout(() => {
      speed1 = false;
      this.slotCurrentIndices.update(curr => [reels[0].length - 1, curr[1], curr[2]]);
      
      this.slotTimeoutId = setTimeout(() => {
        speed2 = false;
        this.slotCurrentIndices.update(curr => [curr[0], reels[1].length - 1, curr[2]]);
        
        this.slotTimeoutId = setTimeout(() => {
          speed3 = false;
          this.slotCurrentIndices.update(curr => [curr[0], curr[1], reels[2].length - 1]);
          clearInterval(this.slotIntervalId);
          this.slotIntervalId = null;
          this.isSlotSpinning.set(false);
          this.slotDone.set(true);
          this.toastService.showToast(`Chúc mừng ${this.clientResult().winners[0]} đã trúng Jackpot Slot!`, 'success');
        }, 1000);
      }, 800);
    }, 1800);
  }

  public skipSlot() {
    if (this.slotIntervalId) {
      clearInterval(this.slotIntervalId);
      this.slotIntervalId = null;
    }
    if (this.slotTimeoutId) {
      clearTimeout(this.slotTimeoutId);
      this.slotTimeoutId = null;
    }
    
    this.isSlotSpinning.set(false);
    this.slotDone.set(true);
    
    const details = this.sessionDetails();
    if (details) {
      const winnerName = details.participants[Number(details.result)] || 'Winner';
      this.slotReels.set([[winnerName], [winnerName], [winnerName]]);
      this.slotCurrentIndices.set([0, 0, 0]);
    }
    this.toastService.showToast(`Chúc mừng ${this.clientResult().winners[0]} đã trúng Jackpot Slot!`, 'success');
  }

  // ================= 9. BỐC BÀI TÂY (CARD DRAW) =================
  public initCardDraw() {
    const details = this.sessionDetails();
    if (!details || !details.participants) return;
    const participantsList = Array.from(details.participants || []) as string[];
    const winnerIdx = Number(details.result);
    const winnerName = participantsList[winnerIdx] || 'Winner';

    const cardsList = [{ name: winnerName, isWinner: true, flipped: false }];
    const others = participantsList
      .filter((p: string, idx: number) => idx !== winnerIdx)
      .sort(() => Math.random() - 0.5)
      .slice(0, 4);

    others.forEach((p: string) => {
      cardsList.push({ name: p, isWinner: false, flipped: false });
    });

    const shuffled = cardsList.sort(() => Math.random() - 0.5);
    this.cards.set(shuffled);
    this.cardDone.set(false);
    this.pickedCardIdx.set(null);
    this.isCardShuffling.set(false);
  }

  public shuffleCards() {
    if (this.isCardShuffling() || this.cardDone()) return;
    this.isCardShuffling.set(true);
    
    setTimeout(() => {
      this.isCardShuffling.set(false);
      this.toastService.showToast('Xáo bài hoàn tất! Vui lòng chọn 1 lá bài tây.', 'success');
    }, 1500);
  }

  public pickCard(idx: number) {
    if (this.isCardShuffling() || this.cardDone() || this.pickedCardIdx() !== null) return;
    
    this.pickedCardIdx.set(idx);
    
    // Lật thẻ được bốc
    this.cards.update(list => {
      const next = [...list];
      next[idx].flipped = true;
      return next;
    });

    // Lật nốt các thẻ khác sau 1s
    setTimeout(() => {
      this.cards.update(list => {
        return list.map(c => ({ ...c, flipped: true }));
      });
      this.cardDone.set(true);
      const isWinner = this.cards()[idx].isWinner;
      if (isWinner) {
        this.toastService.showToast(`Tuyệt vời! Bạn đã chọn trúng lá bài chiến thắng: ${this.cards()[idx].name}`, 'success');
      } else {
        this.toastService.showToast(`Người chiến thắng thực sự là: ${this.clientResult().winners[0]}`, 'success');
      }
    }, 1000);
  }

  public skipCard() {
    this.isCardShuffling.set(false);
    this.cardDone.set(true);
    this.pickedCardIdx.set(0);
    this.cards.update(list => {
      return list.map(c => ({ ...c, flipped: true }));
    });
    this.toastService.showToast(`Người chiến thắng: ${this.clientResult().winners[0]}`, 'success');
  }

  // ================= 10. OẢN TÙ TÌ (OANTUTI) =================
  public resetOanTuTi() {
    this.playerHand.set('rock');
    this.cpuHand.set('rock');
    this.oanTuTiResultText.set('');
    this.oanTuTiDone.set(false);
    this.isOanTuTiRunning.set(false);
  }

  public startOanTuTi() {
    if (this.isOanTuTiRunning() || this.oanTuTiDone()) return;
    this.isOanTuTiRunning.set(true);

    const details = this.sessionDetails();
    if (!details || !details.randomWord) return;

    // Trong lúc lắc tay (2 giây), cả hai bên giữ hình nắm đấm (rock)
    this.playerHand.set('rock');
    this.cpuHand.set('rock');

    this.oanTuTiTimeoutId = setTimeout(() => {
      const seedVal = BigInt(details.randomWord);
      const playerMod = Number(seedVal % 3n);
      const cpuMod = Number((seedVal / 3n) % 3n);
      const handsValue = ['scissors', 'rock', 'paper']; // 0 = Kéo, 1 = Búa, 2 = Bao
      const handsVN = ['Kéo', 'Búa', 'Bao'];
      
      const pHand = handsValue[playerMod];
      const cHand = handsValue[cpuMod];

      this.playerHand.set(pHand);
      this.cpuHand.set(cHand);
      
      this.isOanTuTiRunning.set(false);
      this.oanTuTiDone.set(true);
      
      const winnerName = this.clientResult()?.winners[0] || 'Người chơi';
      let winnerText = '';
      let toastMsg = '';
      if (playerMod === cpuMod) {
        winnerText = `Người chơi "${winnerName}" (${handsVN[playerMod]}) HÒA Máy (${handsVN[cpuMod]})`;
        toastMsg = `Oản tù tì kết thúc! Kết quả HÒA!`;
      } else if ((playerMod === 0 && cpuMod === 2) || (playerMod === 1 && cpuMod === 0) || (playerMod === 2 && cpuMod === 1)) {
        winnerText = `Người chơi "${winnerName}" (${handsVN[playerMod]}) CHIẾN THẮNG Máy (${handsVN[cpuMod]})`;
        toastMsg = `Oản tù tì kết thúc! Người chơi ${winnerName} chiến thắng!`;
      } else {
        winnerText = `Máy (${handsVN[cpuMod]}) CHIẾN THẮNG Người chơi "${winnerName}" (${handsVN[playerMod]})`;
        toastMsg = `Oản tù tì kết thúc! Máy chiến thắng!`;
      }
      this.oanTuTiResultText.set(winnerText);
      this.toastService.showToast(toastMsg, 'success');
    }, 2000);
  }

  public skipOanTuTi() {
    if (this.oanTuTiTimeoutId) clearTimeout(this.oanTuTiTimeoutId);
    this.isOanTuTiRunning.set(false);
    this.oanTuTiDone.set(true);

    const details = this.sessionDetails();
    if (details) {
      const seedVal = BigInt(details.randomWord);
      const playerMod = Number(seedVal % 3n);
      const cpuMod = Number((seedVal / 3n) % 3n);
      const hands = ['scissors', 'rock', 'paper'];
      const handsVN = ['Kéo', 'Búa', 'Bao'];
      this.playerHand.set(hands[playerMod]);
      this.cpuHand.set(hands[cpuMod]);
      
      const winnerName = this.clientResult()?.winners[0] || 'Người chơi';
      let winnerText = '';
      if (playerMod === cpuMod) {
        winnerText = `Người chơi "${winnerName}" (${handsVN[playerMod]}) HÒA Máy (${handsVN[cpuMod]})`;
      } else if ((playerMod === 0 && cpuMod === 2) || (playerMod === 1 && cpuMod === 0) || (playerMod === 2 && cpuMod === 1)) {
        winnerText = `Người chơi "${winnerName}" (${handsVN[playerMod]}) CHIẾN THẮNG Máy (${handsVN[cpuMod]})`;
      } else {
        winnerText = `Máy (${handsVN[cpuMod]}) CHIẾN THẮNG Người chơi "${winnerName}" (${handsVN[playerMod]})`;
      }
      this.oanTuTiResultText.set(winnerText);
    }
  }

  // ================= 11. THỨ TỰ NGẪU NHIÊN (SEQUENCE) =================
  public initSequence() {
    this.isSequenceRunning.set(false);
    this.sequenceDone.set(false);
    const details = this.sessionDetails();
    if (details && details.participants) {
      this.shuffledQueue.set(Array.from(details.participants));
    } else {
      this.shuffledQueue.set([]);
    }
  }

  public startSequence() {
    if (this.isSequenceRunning() || this.sequenceDone()) return;
    this.isSequenceRunning.set(true);

    const details = this.sessionDetails();
    if (!details) return;

    let count = 0;
    const participantsList = Array.from(details.participants || []) as string[];
    const interval = setInterval(() => {
      const mock = [...participantsList].sort(() => Math.random() - 0.5);
      this.shuffledQueue.set(mock);
      count++;
      if (count >= 15) {
        clearInterval(interval);
        
        const res = this.clientResult();
        if (res && res.winners) {
          this.shuffledQueue.set(res.winners);
        }
        this.isSequenceRunning.set(false);
        this.sequenceDone.set(true);
        this.toastService.showToast('Xếp thứ tự ngẫu nhiên hoàn tất!', 'success');
      }
    }, 150);
  }

  public skipSequence() {
    this.isSequenceRunning.set(false);
    this.sequenceDone.set(true);
    const res = this.clientResult();
    if (res && res.winners) {
      this.shuffledQueue.set(res.winners);
    }
  }

  // ================= 12. SƠ ĐỒ CHỖ NGỒI (SEATING CHART) =================
  public initSeating() {
    this.isSeatingRunning.set(false);
    this.seatingDone.set(false);
    
    const details = this.sessionDetails();
    if (!details) return;
    const cols = parseInt(details.skin.split('-')[1]) || 4;
    this.seatingCols.set(cols);

    if (details.participants) {
      const layout: string[][] = [];
      const participantsList = Array.from(details.participants) as string[];
      for (let i = 0; i < participantsList.length; i += cols) {
        layout.push(participantsList.slice(i, i + cols));
      }
      this.seatingLayout.set(layout);
    } else {
      this.seatingLayout.set([]);
    }
  }

  public startSeating() {
    if (this.isSeatingRunning() || this.seatingDone()) return;
    this.isSeatingRunning.set(true);

    const details = this.sessionDetails();
    if (!details) return;
    
    const cols = this.seatingCols();
    const participantsList = Array.from(details.participants || []) as string[];

    let count = 0;
    const interval = setInterval(() => {
      const mock = [...participantsList].sort(() => Math.random() - 0.5);
      const layout: string[][] = [];
      for (let i = 0; i < mock.length; i += cols) {
        layout.push(mock.slice(i, i + cols));
      }
      this.seatingLayout.set(layout);
      count++;
      
      if (count >= 15) {
        clearInterval(interval);
        
        const res = this.clientResult();
        if (res && res.winners) {
          const layoutReal: string[][] = [];
          const winners = res.winners;
          for (let i = 0; i < winners.length; i += cols) {
            layoutReal.push(winners.slice(i, i + cols));
          }
          this.seatingLayout.set(layoutReal);
        }
        
        this.isSeatingRunning.set(false);
        this.seatingDone.set(true);
        this.toastService.showToast('Xếp sơ đồ chỗ ngồi hoàn tất!', 'success');
      }
    }, 150);
  }

  public skipSeating() {
    this.isSeatingRunning.set(false);
    this.seatingDone.set(true);
    
    const details = this.sessionDetails();
    const res = this.clientResult();
    if (details && res && res.winners) {
      const cols = this.seatingCols();
      const layoutReal: string[][] = [];
      const winners = res.winners;
      for (let i = 0; i < winners.length; i += cols) {
        layoutReal.push(winners.slice(i, i + cols));
      }
      this.seatingLayout.set(layoutReal);
    }
  }

  // ================= 13. HÔM NAY ĂN GÌ? (WHAT TO EAT) =================
  private eatTimeoutId: any = null;

  public initWhatToEat() {
    this.isFoodOpening.set(false);
    this.foodOpened.set(false);
    if (this.eatTimeoutId) clearTimeout(this.eatTimeoutId);
  }

  public startWhatToEat() {
    if (this.isFoodOpening() || this.foodOpened()) return;
    this.isFoodOpening.set(true);

    this.eatTimeoutId = setTimeout(() => {
      this.isFoodOpening.set(false);
      this.foodOpened.set(true);
      
      const winners = this.clientResult()?.winners || [];
      if (winners.length === 1) {
        this.toastService.showToast(`Món ngon của bạn hôm nay: ${winners[0]}!`, 'success');
      } else if (winners.length > 1) {
        this.toastService.showToast(`Đã chọn ra ${winners.length} món ngon cho thực đơn hôm nay!`, 'success');
      } else {
        this.toastService.showToast(`Đã mở nắp khay thức ăn!`, 'success');
      }
    }, 2500);
  }

  public skipWhatToEat() {
    if (this.eatTimeoutId) clearTimeout(this.eatTimeoutId);
    this.isFoodOpening.set(false);
    this.foodOpened.set(true);
    
    const winners = this.clientResult()?.winners || [];
    if (winners.length === 1) {
      this.toastService.showToast(`Món ngon của bạn hôm nay: ${winners[0]}!`, 'success');
    } else if (winners.length > 1) {
      this.toastService.showToast(`Đã chọn ra ${winners.length} món ngon cho thực đơn hôm nay!`, 'success');
    } else {
      this.toastService.showToast(`Đã mở nắp khay thức ăn!`, 'success');
    }
  }

  // ================= 14. RÚT BÀI TAROT (TAROT) =================
  public initTarot() {
    this.isTarotRunning.set(false);
    this.tarotDone.set(false);
    this.tarotSelectedIdx.set(null);
    if (this.tarotTimeoutId) clearTimeout(this.tarotTimeoutId);

    const details = this.sessionDetails();
    if (details && details.participants && details.result !== undefined && details.result !== null) {
      if (details.drawType === 3) {
        // Chế độ rút nhiều lá bài Tarot
        const indices = details.result.split(',').map(Number);
        const cardsList = indices.map((winnerIdx: number) => {
          const wName = details.participants[winnerIdx] || 'The Sun (Mặt Trời)';
          return {
            name: wName,
            isWinner: true,
            flipped: false,
            selected: false,
            desc: this.getTarotDesc(wName)
          };
        });
        this.tarotCards.set(cardsList);
      } else {
        // Chế độ rút 1 lá bài Tarot định mệnh (Game 3 lá bài)
        const winnerIdx = Number(details.result);
        const wName = details.participants[winnerIdx] || 'The Sun (Mặt Trời)';
        
        const allTarotList = [
          'The Fool (Chàng Khờ)', 'The Magician (Nhà Ảo Thuật)', 'The High Priestess (Nữ Tư Tế)',
          'The Empress (Nữ Hoàng)', 'The Emperor (Hoàng Đế)', 'The Hierophant (Giáo Hoàng)',
          'The Lovers (Tình Nhân)', 'The Chariot (Chiến Xa)', 'Strength (Sức Mạnh)',
          'The Hermit (Ẩn Sĩ)', 'Wheel of Fortune (Vòng Quay Số Phận)', 'Justice (Công Lý)',
          'The Hanged Man (Kẻ Treo)', 'Death (Tử Thần)', 'Temperance (Tiết Độ)',
          'The Devil (Ác Quỷ)', 'The Tower (Tòa Tháp)', 'The Star (Ngôi Sao)',
          'The Moon (Mặt Trăng)', 'The Sun (Mặt Trời)', 'Judgement (Phán Xét)', 'The World (Thế Giới)'
        ];

        const fakes = allTarotList.filter(c => c !== wName);
        const fake1 = fakes[Number(BigInt(details.randomWord || 0) % BigInt(fakes.length))];
        const fakes2 = fakes.filter(c => c !== fake1);
        const fake2 = fakes2[Number((BigInt(details.randomWord || 0) / 2n) % BigInt(fakes2.length))];

        const winPos = Number(BigInt(details.randomWord || 0) % 3n);
        const cardsList = new Array(3);
        cardsList[winPos] = { name: wName, isWinner: true, flipped: false, selected: false, desc: this.getTarotDesc(wName) };
        
        let fakeIdx = 0;
        const fakeArr = [fake1, fake2];
        for (let i = 0; i < 3; i++) {
          if (i !== winPos) {
            const fakeName = fakeArr[fakeIdx++];
            cardsList[i] = { name: fakeName, isWinner: false, flipped: false, selected: false, desc: this.getTarotDesc(fakeName) };
          }
        }
        this.tarotCards.set(cardsList);
      }
    }
  }

  public selectTarotCard(idx: number) {
    if (this.isTarotRunning() || this.tarotDone()) return;
    this.tarotSelectedIdx.set(idx);
    this.startTarotAnimation(idx);
  }

  public startTarot() {
    if (this.isTarotRunning() || this.tarotDone()) return;
    const cardsList = this.tarotCards();
    const winIdx = cardsList.findIndex(c => c.isWinner);
    this.tarotSelectedIdx.set(winIdx >= 0 ? winIdx : 1);
    this.startTarotAnimation(winIdx >= 0 ? winIdx : 1);
  }

  private startTarotAnimation(selectedIdx: number) {
    this.isTarotRunning.set(true);
    
    this.tarotTimeoutId = setTimeout(() => {
      this.isTarotRunning.set(false);
      this.tarotDone.set(true);

      const cardsList = this.tarotCards().map((c, i) => {
        if (i === selectedIdx || c.isWinner) {
          return { ...c, flipped: true, selected: i === selectedIdx };
        }
        return c;
      });
      this.tarotCards.set(cardsList);

      const details = this.sessionDetails();
      if (details && details.drawType === 3) {
        this.toastService.showToast(`Đã rút thành công bộ ${cardsList.length} lá bài Tarot!`, 'success');
      } else {
        const winnerCard = cardsList.find(c => c.isWinner);
        if (winnerCard) {
          this.toastService.showToast(`Bạn đã rút được lá bài: ${winnerCard.name}!`, 'success');
        }
      }
    }, 2000);
  }

  public skipTarot() {
    if (this.tarotTimeoutId) clearTimeout(this.tarotTimeoutId);
    this.isTarotRunning.set(false);
    this.tarotDone.set(true);

    const cardsList = this.tarotCards().map(c => ({ ...c, flipped: true }));
    this.tarotCards.set(cardsList);

    const details = this.sessionDetails();
    if (details && details.drawType === 3) {
      this.toastService.showToast(`Kết quả rút bộ ${cardsList.length} lá bài Tarot!`, 'success');
    } else {
      const winnerCard = cardsList.find(c => c.isWinner);
      if (winnerCard) {
        this.toastService.showToast(`Kết quả rút bài: ${winnerCard.name}!`, 'success');
      }
    }
  }

  public getTarotDesc(cardName: string): string {
    const cards = [
      { name: 'The Fool (Chàng Khờ)', desc: 'Khởi đầu mới, hành trình phiêu lưu và niềm tin thuần khiết.' },
      { name: 'The Magician (Nhà Ảo Thuật)', desc: 'Ý chí mạnh mẽ, tài năng thiên bẩm và khả năng hiện thực hóa ước mơ.' },
      { name: 'The High Priestess (Nữ Tư Tế)', desc: 'Trực giác nhạy bén, tri thức bí ẩn và thế giới nội tâm sâu sắc.' },
      { name: 'The Empress (Nữ Hoàng)', desc: 'Sự sung túc, khả năng sáng tạo, tình mẫu tử và thiên nhiên trù phú.' },
      { name: 'The Emperor (Hoàng Đế)', desc: 'Quyền lực, kỷ luật thép, sự bảo hộ và tính trật tự.' },
      { name: 'The Hierophant (Giáo Hoàng)', desc: 'Truyền thống, niềm tin tôn giáo, sự giáo dục và lời khuyên thông thái.' },
      { name: 'The Lovers (Tình Nhân)', desc: 'Tình yêu đôi lứa, sự hòa hợp và những lựa chọn quan trọng từ trái tim.' },
      { name: 'The Chariot (Chiến Xa)', desc: 'Chiến thắng vượt bậc nhờ ý chí kiên định và sự kiểm soát.' },
      { name: 'Strength (Sức Mạnh)', desc: 'Lòng quả cảm, sự nhẫn nại và sức mạnh tinh thần thuần hóa nghịch cảnh.' },
      { name: 'The Hermit (Ẩn Sĩ)', desc: 'Sự chiêm nghiệm, tìm kiếm chân lý nội tâm và sự cô độc thông thái.' },
      { name: 'Wheel of Fortune (Vòng Quay Số Phận)', desc: 'Sự thay đổi định mệnh, cơ hội bất ngờ và chu kỳ mới.' },
      { name: 'Justice (Công Lý)', desc: 'Sự công bằng, chân lý, luật nhân quả và quyết định sáng suốt.' },
      { name: 'The Hanged Man (Kẻ Treo)', desc: 'Sự hy sinh cống hiến, góc nhìn mới mẻ và sự tạm dừng cần thiết.' },
      { name: 'Death (Tử Thần)', desc: 'Sự kết thúc để khởi đầu mới, chuyển hóa sâu sắc và buông bỏ.' },
      { name: 'Temperance (Tiết Độ)', desc: 'Sự cân bằng, hòa hợp, kiên nhẫn và dòng chảy trung dung.' },
      { name: 'The Devil (Ác Quỷ)', desc: 'Sự ràng buộc vật chất, cám dỗ và nỗi sợ hãi vô hình.' },
      { name: 'The Tower (Tòa Tháp)', desc: 'Sự sụp đổ bất ngờ, thay đổi đột ngột giải phóng khỏi xiềng xích.' },
      { name: 'The Star (Ngôi Sao)', desc: 'Niềm hy vọng, sự chữa lành vết thương lòng và niềm tin vào tương lai.' },
      { name: 'The Moon (Mặt Trăng)', desc: 'Sự mơ hồ, ảo ảnh, nỗi sợ tiềm thức và trực giác trỗi dậy.' },
      { name: 'The Sun (Mặt Trời)', desc: 'Thành công rực rỡ, niềm vui tràn ngập, năng lượng tích cực và sự tỏ tường.' },
      { name: 'Judgement (Phán Xét)', desc: 'Sự thức tỉnh tâm linh, tiếng gọi lương tri và sự tha thứ giải thoát.' },
      { name: 'The World (Thế Giới)', desc: 'Sự hoàn thành viên mãn, thành tựu trọn vẹn và sự tự do tuyệt đối.' }
    ];
    const clean = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, '');
    const target = clean(cardName);
    const found = cards.find(c => clean(c.name).includes(target) || target.includes(clean(c.name)));
    return found ? found.desc : 'Một lá bài may mắn mang thông điệp tích cực cho bạn hôm nay.';
  }

  // ================= 15. QUAY SỐ BINGO (BINGO) =================
  private bingoBallIntervalId: any = null;

  public getBingoResults(): number[] {
    const details = this.sessionDetails();
    if (!details || !details.result) return [];
    if (details.drawType === 3) {
      return details.result.split(',').map((x: string) => Number(x) + 1);
    }
    return [Number(details.result)];
  }

  public initBingo() {
    this.isBingoRunning.set(false);
    this.bingoDone.set(false);
    this.bingoNumber.set(null);
    this.bingoNumbers.set([]);
    if (this.bingoBallIntervalId) clearInterval(this.bingoBallIntervalId);
    if (this.bingoTimeoutId) clearTimeout(this.bingoTimeoutId);
    this.bingoBallList.set([12, 25, 47, 88, 9, 36, 73, 52, 61, 80]);
  }

  public startBingo() {
    if (this.isBingoRunning() || this.bingoDone()) return;
    this.isBingoRunning.set(true);

    const details = this.sessionDetails();
    if (!details || !details.result) return;
    const results = this.getBingoResults();

    this.bingoBallIntervalId = setInterval(() => {
      const randomBalls = Array.from({ length: 10 }, () => Math.floor(Math.random() * 90) + 1);
      this.bingoBallList.set(randomBalls);
    }, 100);

    this.bingoTimeoutId = setTimeout(() => {
      if (this.bingoBallIntervalId) clearInterval(this.bingoBallIntervalId);
      this.isBingoRunning.set(false);
      this.bingoDone.set(true);
      this.bingoNumbers.set(results);
      if (results.length > 0) {
        this.bingoNumber.set(results[results.length - 1]);
      }
      if (results.length === 1) {
        this.toastService.showToast(`Bingo! Con số may mắn là: ${results[0]}!`, 'success');
      } else {
        this.toastService.showToast(`Bingo! Đã quay ra ${results.length} con số may mắn!`, 'success');
      }
    }, 3000);
  }

  public skipBingo() {
    if (this.bingoBallIntervalId) clearInterval(this.bingoBallIntervalId);
    if (this.bingoTimeoutId) clearTimeout(this.bingoTimeoutId);
    this.isBingoRunning.set(false);
    this.bingoDone.set(true);

    const results = this.getBingoResults();
    this.bingoNumbers.set(results);
    if (results.length > 0) {
      this.bingoNumber.set(results[results.length - 1]);
    }
  }
}
