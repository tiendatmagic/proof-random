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
      }
    }, 5000); // Polling mỗi 5 giây
  }

  private stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
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
    return `https://chart.googleapis.com/chart?chs=220x220&cht=qr&chl=${encodeURIComponent(window.location.href)}&choe=UTF-8`;
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
}
