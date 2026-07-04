import { Component, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Web3Service } from '../../core/services/web3.service';
import { ToastService } from '../../core/services/toast.service';
import { jsPDF } from 'jspdf';
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
   * Xuất dữ liệu ra file CSV
   */
  public exportAsCSV() {
    const details = this.sessionDetails();
    const result = this.clientResult();
    if (!details) return;

    let csvContent = '\uFEFF'; // Thêm BOM để hiển thị đúng tiếng Việt có dấu trong Excel
    csvContent += 'Phiếu bốc thăm,Tên sự kiện,Người tạo,Ngày quay,Request ID,Tx Hash\n';
    csvContent += `"${details.requestId}","${details.eventName.split(' | ')[0]}","${details.creator}","${new Date(details.timestamp * 1000).toLocaleString()}","${details.requestId}","${details.txHash}"\n\n`;

    csvContent += 'STT,Tên người tham gia,Trạng thái kết quả\n';
    
    // Đánh dấu trạng thái chiến thắng của từng thành viên
    details.participants.forEach((p: string, idx: number) => {
      let status = 'Tham gia';
      if (details.drawType === 2 && Number(details.result) === idx) {
        status = 'CHIẾN THẮNG (Winner)';
      } else if (details.drawType === 3) {
        const winnerIndices = details.result.split(',').map(Number);
        if (winnerIndices.includes(idx)) {
          status = 'CHIẾN THẮNG (Winner)';
        }
      } else if (details.drawType === 9 && result && result.teams) {
        // Tìm đội của người này
        for (const t of result.teams) {
          if (t.members.includes(p)) {
            status = `Được xếp vào ${t.name}`;
            break;
          }
        }
      }
      csvContent += `${idx + 1},"${p.replace(/"/g, '""')}","${status}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', url);
    downloadAnchor.setAttribute('download', `ProofRandom_${details.requestId}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    this.toastService.showToast('Đã xuất file CSV thành công!', 'success');
  }

  /**
   * Xuất báo cáo bốc thăm ra file PDF chuyên nghiệp
   */
  public exportAsPDF() {
    const details = this.sessionDetails();
    const result = this.clientResult();
    if (!details || !result) return;

    try {
      const doc = new jsPDF();
      const eventName = details.eventName.split(' | ')[0];
      const desc = details.eventName.split(' | ')[1] || '';

      // Thiết lập phông chữ và màu sắc tiêu đề
      doc.setFillColor(15, 23, 42); // slate-900 làm header background
      doc.rect(0, 0, 210, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("PROOFRANDOM - BLOCKCHAIN REPORT", 15, 25);
      
      // Nội dung thông tin chung
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(14);
      doc.text(`Tên phiên: ${eventName}`, 15, 55);
      if (desc) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.text(`Mô tả: ${desc}`, 15, 62);
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("THÔNG TIN BLOCKCHAIN & CHỨNG THỰC", 15, 75);
      doc.line(15, 77, 195, 77);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Địa chỉ ví tạo (Creator): ${details.creator}`, 15, 84);
      doc.text(`Loại bốc thăm: ${this.getDrawTypeName(details.drawType)}`, 15, 90);
      doc.text(`Mã giao dịch (Tx Hash): ${details.txHash}`, 15, 96);
      doc.text(`Mã yêu cầu VRF (Request ID): ${details.requestId}`, 15, 102);
      doc.text(`Số ngẫu nhiên (Chainlink Seed): ${details.randomWord}`, 15, 108);
      doc.text(`Thời gian xác thực: ${new Date(details.timestamp * 1000).toLocaleString()}`, 15, 114);

      // Render người chiến thắng
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(255, 0, 221); // Màu Hồng Neon chủ đạo
      
      let winnerY = 130;
      doc.text("KẾT QUẢ BỐC THĂM CHÍNH THỨC", 15, winnerY);
      doc.line(15, winnerY + 2, 195, winnerY + 2);
      doc.setTextColor(15, 23, 42);

      let currentY = winnerY + 12;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      
      if (details.drawType === 3) {
        result.winners.forEach((w: string, i: number) => {
          doc.text(`🏆 Người thắng giải ${i + 1}: ${w}`, 20, currentY);
          currentY += 8;
        });
      } else if (details.drawType === 9) {
        result.teams.forEach((t: any) => {
          doc.text(`📦 ${t.name}:`, 20, currentY);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          doc.text(`Thành viên: ${t.members.join(', ')}`, 25, currentY + 5);
          currentY += 14;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(12);
        });
      } else {
        doc.setFontSize(16);
        doc.text(`🏆 Kết quả: ${result.winners[0] || details.result}`, 20, currentY);
      }

      // Add QR Code Verify
      const qrApiUrl = this.getQrImageUrl();
      // Ta có thể chèn ảnh QR trực tiếp vào PDF nếu RPC load ảnh khả thi (để đơn giản chèn link verify)
      const verifyY = 240;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("TÀI LIỆU XÁC MINH TOÀN CẦU", 15, verifyY);
      doc.line(15, verifyY + 2, 195, verifyY + 2);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text("Kết quả bốc thăm này được sinh ra bởi Chainlink VRF ngẫu nhiên, không thể can thiệp bởi nhà phát triển hệ thống.", 15, verifyY + 8);
      doc.text("Bạn có thể verify lại thuật toán bốc thăm này tại trang Xác minh của ProofRandom.", 15, verifyY + 12);

      doc.save(`ProofRandom_BaoCao_${details.requestId}.pdf`);
      this.toastService.showToast('Đã xuất báo cáo PDF thành công!', 'success');
    } catch (err) {
      console.error('[Detail] Xuất PDF lỗi:', err);
      this.toastService.showToast('Lỗi xuất PDF. Hãy thử lại.', 'error');
    }
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
  public isWheelSpinning = false;
  public wheelSpinDone = false;
  
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
      
      ctx.clearRect(0, 0, 300, 300);
      
      // Vẽ các phân vùng
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
    }, 100);
  }
  
  public spinWheel() {
    if (this.isWheelSpinning || this.wheelSpinDone) return;
    this.isWheelSpinning = true;
    
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
        this.isWheelSpinning = false;
        this.wheelSpinDone = true;
        this.toastService.showToast(`Chúc mừng ${this.clientResult().winners[0]} đã chiến thắng!`, 'success');
      }
    };
    
    this.wheelAnimationFrameId = requestAnimationFrame(animate);
  }

  // 2. Đua xe ngẫu nhiên (Random Racing)
  public isRacing = false;
  public raceDone = false;
  public readonly racerProgresses = signal<number[]>([]);

  private initRacingProgress() {
    const details = this.sessionDetails();
    if (details && details.participants && this.skinType === 'Racing') {
      this.racerProgresses.set(new Array(details.participants.length).fill(0));
    }
  }
  
  public startRace() {
    if (this.isRacing || this.raceDone) return;
    this.isRacing = true;
    
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
        this.isRacing = false;
        this.raceDone = true;
        this.toastService.showToast(`Chúc mừng ${this.clientResult().winners[0]} đã về đích đầu tiên!`, 'success');
      }
    };
    this.raceAnimationFrameId = requestAnimationFrame(animate);
  }

  // 3. Hộp quà bí ẩn (Mystery Box)
  public isBoxOpening = false;
  public boxOpened = false;
  
  public openBox() {
    if (this.isBoxOpening || this.boxOpened) return;
    this.isBoxOpening = true;
    
    this.boxTimeoutId = setTimeout(() => {
      this.isBoxOpening = false;
      this.boxOpened = true;
      this.toastService.showToast(`Hộp quà đã mở! Chúc mừng: ${this.clientResult().winners[0]}`, 'success');
    }, 2000);
  }

  // 4. Bầu Cua Tôm Cá (Bau Cua)
  public isBauCuaShaking = false;
  public bauCuaOpened = false;
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
    if (this.isBauCuaShaking || this.bauCuaOpened) return;
    this.isBauCuaShaking = true;
    
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
      this.isBauCuaShaking = false;
      this.bauCuaOpened = true;
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
    
    this.isRacing = false;
    this.raceDone = true;
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
    
    this.isWheelSpinning = false;
    this.wheelSpinDone = true;
    this.toastService.showToast(`Chúc mừng ${this.clientResult().winners[0]} đã chiến thắng!`, 'success');
  }

  public skipBox() {
    if (this.boxTimeoutId) {
      clearTimeout(this.boxTimeoutId);
      this.boxTimeoutId = null;
    }
    this.isBoxOpening = false;
    this.boxOpened = true;
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
    this.isBauCuaShaking = false;
    this.bauCuaOpened = true;
    const winnersText = this.bauCuaResultDice.map(i => this.bauCuaItems[i].name).join(' - ');
    this.toastService.showToast(`Kết quả Bầu Cua: ${winnersText}`, 'success');
  }

  // 5. Vé số cào (Scratch Card)
  public isScratched = false;
  public scratchDone = false;
  
  public initScratchCard() {
    setTimeout(() => {
      const canvas = document.getElementById('scratchCanvas') as HTMLCanvasElement;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(0, 0, 240, 120);
      
      ctx.font = 'bold 12px Quicksand, sans-serif';
      ctx.fillStyle = '#1e293b';
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
        this.isScratched = true;
      };
      
      canvas.ontouchstart = () => isDrawing = true;
      canvas.ontouchend = () => isDrawing = false;
      canvas.ontouchmove = (e) => {
        e.preventDefault();
        if (!isDrawing) return;
        const pos = getPos(e);
        scratch(pos.x, pos.y);
        this.isScratched = true;
      };
    }, 100);
  }
  
  public autoScratch() {
    this.isScratched = true;
    this.scratchDone = true;
    const canvas = document.getElementById('scratchCanvas') as HTMLCanvasElement;
    if (canvas) {
      canvas.style.opacity = '0';
      setTimeout(() => canvas.style.display = 'none', 300);
    }
  }
}
