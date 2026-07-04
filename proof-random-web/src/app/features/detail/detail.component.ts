import { Component, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Web3Service } from '../../core/services/web3.service';
import { ToastService } from '../../core/services/toast.service';
import { CardComponent } from '../../shared/components/card/card.component';
import { SkeletonLoaderComponent } from '../../shared/components/skeleton-loader/skeleton-loader.component';

@Component({
  selector: 'app-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, CardComponent, SkeletonLoaderComponent],
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

  // Lưu trữ interval để dọn dẹp (polling)
  private pollingInterval: any = null;

  // Lưu trữ animation frame ID và timeout ID để dọn dẹp khi bỏ qua (skip)
  private raceAnimationFrameId: any = null;
  private wheelAnimationFrameId: any = null;
  private boxTimeoutId: any = null;
  private bauCuaTimeoutId: any = null;

  constructor() {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.requestId.set(id);
    
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
          this.stopPolling(); // Dừng polling nếu đã nhận được kết quả
          this.checkAndInitSkins(data);
        } else {
          // Bắt đầu cơ chế polling nếu chưa nhận được kết quả (đang chờ VRF callback)
          this.startPolling();
        }
      } else {
        this.toastService.showToast('Không tìm thấy dữ liệu phiên bốc thăm!', 'error');
      }
    } catch (err) {
      console.error('[Detail] Tải chi tiết lỗi:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Khởi tạo canvas cho các trò chơi ngẫu nhiên
   */
  private checkAndInitSkins(data: any) {
    if (data && data.skin === 'LuckyWheel') {
      this.initWheelCanvas();
    } else if (data && data.skin === 'ScratchCard') {
      this.initScratchCard();
    } else if (data && data.skin === 'Racing') {
      this.initRacingProgress();
    } else if (data && data.skin === 'Vietlott') {
      this.resetVietlottState();
    }
  }

  /**
   * Cơ chế tự động truy vấn cập nhật trạng thái (Polling)
   */
  private startPolling() {
    if (this.pollingInterval) return;

    console.log('[Web3] Đang đợi kết quả Chainlink VRF. Bắt đầu polling...');
    this.pollingInterval = setInterval(async () => {
      const id = this.requestId();
      const data = await this.web3Service.getDrawSessionDetails(id);
      
      if (data && data.fulfilled) {
        console.log('[Web3] Chainlink VRF đã trả kết quả. Dừng polling.');
        this.sessionDetails.set(data);
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
        this.checkAndInitSkins(data);
      }
    }, 5000); // Polling mỗi 5 giây
  }

  private stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
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
    if (this.boxTimeoutId) clearTimeout(this.boxTimeoutId);
    if (this.bauCuaTimeoutId) clearTimeout(this.bauCuaTimeoutId);
    if (this.vietlottIntervalId) clearInterval(this.vietlottIntervalId);
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
    const typeName = this.getDrawTypeName(details.drawType);
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
      drawTypeName: this.getDrawTypeName(details.drawType),
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
  public getDrawTypeName(type: number): string {
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

  private markAnimationsAsDone() {
    this.wheelSpinDone.set(true);
    this.raceDone.set(true);
    this.boxOpened.set(true);
    this.bauCuaOpened.set(true);
    this.scratchDone.set(true);
    this.vietlottDone.set(true);
    
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
      const current = new Array(count).fill(50);
      current[winnerIdx] = 100;
      this.racerProgresses.set(current);
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
  public vietlottIntervalId: any = null;

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
}
