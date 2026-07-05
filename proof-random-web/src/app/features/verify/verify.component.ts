import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Web3Service } from '../../core/services/web3.service';
import { ToastService } from '../../core/services/toast.service';
import { CardComponent } from '../../shared/components/card/card.component';
import { SpinnerComponent } from '../../shared/components/spinner/spinner.component';

/** Mỗi bước hash keccak256 trong chuỗi xác minh */
export interface HashStep {
  stepIndex: number;
  label: string;          // Mô tả bước (ví dụ: "Bước 1 — Chọn quả bóng Mega645_0")
  inputSeed: string;      // Seed đầu vào (rút gọn)
  inputSeedFull: string;  // Seed đầu vào (đầy đủ, dùng khi copy)
  hashOutput: string;     // Hash đầu ra (rút gọn)
  hashOutputFull: string; // Hash đầu ra đầy đủ
  poolSizeBefore: number; // Pool size trước khi rút
  indexChosen: number;    // Vị trí rút trong pool
  valueChosen: number | string; // Giá trị rút ra
}

/** Chế độ chỉ dùng mod trực tiếp, không qua hash chain */
export interface DirectModResult {
  label: string;
  formula: string;    // Ví dụ: "randomWord % (max - min + 1)"
  modulo: string;     // Giá trị modulo
  result: string;     // Kết quả cuối
}

@Component({
  selector: 'app-verify',
  standalone: true,
  imports: [CommonModule, FormsModule, CardComponent, SpinnerComponent],
  templateUrl: './verify.component.html'
})
export class VerifyComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  public readonly web3Service = inject(Web3Service);
  private readonly toastService = inject(ToastService);

  // Đầu vào tìm kiếm
  public queryInput = '';

  // Trạng thái verify
  public readonly sessionDetails = signal<any | null>(null);
  public readonly clientResult = signal<any | null>(null);
  public readonly isVerifying = signal<boolean>(false);
  public readonly hasSearched = signal<boolean>(false);
  public readonly isVerifiedSuccess = signal<boolean>(false);

  // Dữ liệu chuỗi bước hash xác minh
  public readonly hashSteps = signal<HashStep[]>([]);
  public readonly directModResult = signal<DirectModResult | null>(null);
  public readonly isHashChain = signal<boolean>(false); // true nếu dùng hash chain, false nếu dùng mod trực tiếp

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const q = params['q'];
      if (q && q.trim()) {
        this.queryInput = q.trim();
        this.runVerification();
      }
    });
  }

  /** Rút gọn chuỗi hash thành dạng 0x1234...abcd */
  public shortHash(hash: string): string {
    if (!hash || hash.length <= 14) return hash;
    return `${hash.substring(0, 10)}...${hash.substring(hash.length - 6)}`;
  }

  /** Copy text vào clipboard */
  public copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      this.toastService.showToast('Đã sao chép!', 'success');
    });
  }

  /**
   * Sinh danh sách từng bước tính toán hash để hiển thị trực quan trên UI
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

    // --- NHÓM 1: Chỉ dùng mod trực tiếp, không hash chain ---
    if (drawType === 1) {
      if (details.skin === 'Vietlott') {
        this.directModResult.set({
          label: 'Xổ số Vietlott — Tính số kiểm tra (On-Chain)',
          formula: `randomWord % 80 + 1`,
          modulo: `${randomWord} % 80 = ${Number(seed % 80n)}`,
          result: `Số kiểm tra: ${Number(seed % 80n) + 1}`
        });
        return;
      }

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
        return;
      }

      const min = BigInt(param1);
      const max = BigInt(param2);
      const range = max - min + 1n;
      const mod = seed % range;
      const result = (min + mod).toString();
      this.directModResult.set({
        label: 'Random Number — Tính trực tiếp từ randomWord',
        formula: `randomWord % (max − min + 1) + min`,
        modulo: `${randomWord} % ${range.toString()} = ${mod.toString()}`,
        result: `Vị trí: ${mod.toString()} → Kết quả: ${result}`
      });
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

    // --- NHÓM 2: Dùng hash chain ---
    this.isHashChain.set(true);

    if (drawType === 7) {
      const hashHex = this.web3Service.solidityKeccak256(['uint256'], [randomWord]);
      const byte31 = hashHex.substring(hashHex.length - 2);
      const byte30 = hashHex.substring(hashHex.length - 4, hashHex.length - 2);
      const byte29 = hashHex.substring(hashHex.length - 6, hashHex.length - 4);
      const color = ('#' + byte31 + byte30 + byte29).toUpperCase();
      const steps: HashStep[] = [{
        stepIndex: 1,
        label: 'Bước 1 — Băm randomWord → Mã màu HEX',
        inputSeed: this.shortHash(randomWord),
        inputSeedFull: randomWord,
        hashOutput: this.shortHash(hashHex),
        hashOutputFull: hashHex,
        poolSizeBefore: 0,
        indexChosen: 0,
        valueChosen: `3 byte cuối đảo ngược (hash[31], hash[30], hash[29]): "${(byte31 + byte30 + byte29).toUpperCase()}" → Màu: ${color}`
      }];
      this.hashSteps.set(steps);
      return;
    }

    if (drawType === 3) {
      const k = param2;
      const total = param1;
      const steps: HashStep[] = [];
      let tempRandom = seed;
      const winnerIndices: number[] = [];

      let labelPrefix = 'Chọn người thắng thứ';
      if (details.skin === 'Sequence') {
        labelPrefix = 'Xếp vị trí thứ';
      } else if (details.skin && details.skin.startsWith('Seating')) {
        labelPrefix = 'Xếp vào vị trí ghế thứ';
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
        const inputSeed = tempRandom.toString();
        const hashHex = this.web3Service.solidityKeccak256(['uint256', 'uint256'], [tempRandom.toString(), i.toString()]);
        tempRandom = BigInt(hashHex);
        let candidate = Number(tempRandom % BigInt(total));

        let duplicate = winnerIndices.includes(candidate);
        if (duplicate) {
          let attempt = 0;
          while (duplicate && attempt < 30) {
            const retryHash = this.web3Service.solidityKeccak256(['uint256', 'uint256'], [tempRandom.toString(), (attempt + 100).toString()]);
            tempRandom = BigInt(retryHash);
            candidate = Number(tempRandom % BigInt(total));
            duplicate = winnerIndices.includes(candidate);
            attempt++;
          }
        }
        winnerIndices.push(candidate);

        const rawName = participants && participants[candidate] ? participants[candidate] : `Index ${candidate}`;
        const name = rawName.replace(/_\d+$/, '');
        
        let valueChosenText = `Vị trí index ${candidate} → "${name}"`;
        if (details.skin === 'Sequence') {
          valueChosenText = `Hàng đợi #${i + 1} → "${name}"`;
        } else if (details.skin && details.skin.startsWith('Seating')) {
          const cols = parseInt(details.skin.split('-')[1]) || 4;
          const row = Math.floor(i / cols) + 1;
          const col = (i % cols) + 1;
          valueChosenText = `Hàng ${row}, Cột ${col} (Bàn số ${i + 1}) → "${name}"`;
        } else if (details.skin === 'WhatToEat') {
          valueChosenText = `Chọn món ăn #${i + 1} → "${name}"`;
        } else if (details.skin === 'Bingo') {
          valueChosenText = `Bóng số #${i + 1} → Bóng số ${candidate + 1}`;
        } else if (details.skin === 'RandomLetter') {
          valueChosenText = `Chữ cái #${i + 1} → "${name}"`;
        } else if (details.skin === 'Dice') {
          const cleanDice = String(participants[candidate] || candidate + 1).replace(/_\d+$/, '');
          valueChosenText = `Xúc xắc #${i + 1} → Mặt số ${cleanDice}`;
        } else if (details.skin === 'CoinFlip') {
          const cleanCoin = String(participants[candidate] || (candidate === 0 ? 'Heads' : 'Tails')).replace(/_\d+$/, '');
          valueChosenText = `Đồng xu #${i + 1} → Mặt ${cleanCoin}`;
        }

        steps.push({
          stepIndex: i + 1,
          label: `Bước ${i + 1} — ${labelPrefix} ${i + 1}`,
          inputSeed: this.shortHash(inputSeed),
          inputSeedFull: inputSeed,
          hashOutput: this.shortHash(hashHex),
          hashOutputFull: hashHex,
          poolSizeBefore: total - i,
          indexChosen: candidate,
          valueChosen: valueChosenText
        });
      }
      this.hashSteps.set(steps);
      return;
    }

    if (drawType === 9) {
      const total = param1;
      const steps: HashStep[] = [];
      let tempRandom = seed;
      const MAX_DISPLAY = Math.min(total - 1, 10);

      for (let i = total - 1; i > total - 1 - MAX_DISPLAY; i--) {
        const inputSeed = tempRandom.toString();
        const hashHex = this.web3Service.solidityKeccak256(['uint256', 'uint256'], [tempRandom.toString(), i.toString()]);
        tempRandom = BigInt(hashHex);
        const swapIdx = Number(tempRandom % BigInt(i + 1));
        steps.push({
          stepIndex: total - i,
          label: `Bước ${total - i} — Hoán vị Fisher-Yates (i=${i})`,
          inputSeed: this.shortHash(inputSeed),
          inputSeedFull: inputSeed,
          hashOutput: this.shortHash(hashHex),
          hashOutputFull: hashHex,
          poolSizeBefore: i + 1,
          indexChosen: swapIdx,
          valueChosen: `Hoán vị vị trí ${i} ↔ ${swapIdx}`
        });
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
   * Chạy quy trình xác minh tính minh bạch
   */
  public async runVerification() {
    const query = this.queryInput.trim();
    if (!query) {
      this.toastService.showToast('Vui lòng nhập mã Request ID!', 'error');
      return;
    }

    this.isVerifying.set(true);
    this.hasSearched.set(true);
    this.sessionDetails.set(null);
    this.clientResult.set(null);
    this.isVerifiedSuccess.set(false);
    this.hashSteps.set([]);
    this.directModResult.set(null);
    this.isHashChain.set(false);

    try {
      await this.web3Service.detectAndSwitchChain(query);

      let requestId = query;

      if (query.startsWith('0x') && query.length === 66) {
        const contract = this.web3Service.getContract(false);
        const filter = contract['filters']['DrawCreated']();
        const events = await contract.queryFilter(filter, 0, 'latest');

        const targetEvent = events.find(e => e.transactionHash.toLowerCase() === query.toLowerCase());
        if (targetEvent) {
          requestId = (targetEvent as any).args.requestId.toString();
        } else {
          this.toastService.showToast('Không tìm thấy phiên bốc thăm tương ứng với Tx Hash này!', 'error');
          this.isVerifying.set(false);
          return;
        }
      }

      const data = await this.web3Service.getDrawSessionDetails(requestId);
      if (data) {
        this.sessionDetails.set(data);

        if (data.fulfilled && data.randomWord && data.randomWord !== '0') {
          const clientRes = this.web3Service.calculateResultClientSide(
            data.drawType,
            data.param1,
            data.param2,
            data.randomWord,
            data.participants
          );
          this.clientResult.set(clientRes);

          if (data.drawType === 9) {
            this.isVerifiedSuccess.set(clientRes && clientRes.teams && clientRes.teams.length === data.param2);
          } else {
            this.isVerifiedSuccess.set(data.result.trim() === clientRes.result.trim());
          }

          // Sinh danh sách bước hash sau khi verify
          this.buildHashSteps(data);

          if (this.isVerifiedSuccess()) {
            this.toastService.showToast('Xác minh thành công! Kết quả hoàn toàn minh bạch.', 'success');
          } else {
            this.toastService.showToast('Cảnh báo: Phát hiện sai lệch kết quả!', 'error');
          }
        }
      } else {
        this.toastService.showToast('Không tìm thấy phiên bốc thăm với ID được yêu cầu!', 'error');
      }
    } catch (err) {
      console.error('[Verify] Lỗi xác minh bốc thăm:', err);
      this.toastService.showToast('Đã xảy ra lỗi trong quá trình xác minh.', 'error');
    } finally {
      this.isVerifying.set(false);
    }
  }

  public isNumberWinners(): boolean {
    const res = this.clientResult();
    if (!res || !res.winners || res.winners.length === 0) return false;
    return !isNaN(Number(res.winners[0]));
  }

  public get skinType(): string {
    const details = this.sessionDetails();
    return details && details.skin ? details.skin : '';
  }

  public getDrawTypeName(type: number, skin?: string): string {
    if (skin && skin.startsWith('RandomNumber')) return 'Quay số ngẫu nhiên';
    if (type === 3 && this.isNumberWinners()) return 'Quay số ngẫu nhiên';
    if (skin && skin.startsWith('Seating')) return 'Sơ đồ chỗ ngồi';

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
      1: 'Quay số ngẫu nhiên',
      2: 'Chọn 1 tên ngẫu nhiên',
      3: 'Chọn nhiều người thắng',
      4: 'Lật đồng xu',
      5: 'Quay xúc xắc',
      6: 'Chẵn / Lẻ',
      7: 'Màu sắc ngẫu nhiên',
      8: 'Chữ cái ngẫu nhiên (A-Z)',
      9: 'Chia đội ngẫu nhiên',
    };
    return names[type] || 'Chưa xác định';
  }

  public getBingoWinnersFormatted(): string {
    const details = this.sessionDetails();
    if (!details || !details.result) return '';
    if (details.drawType === 3) {
      return details.result.split(',').map((x: string) => Number(x) + 1).join(', ');
    }
    return details.result;
  }
}
