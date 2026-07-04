import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Web3Service } from '../../core/services/web3.service';
import { ToastService } from '../../core/services/toast.service';
import { CardComponent } from '../../shared/components/card/card.component';
import { SkeletonLoaderComponent } from '../../shared/components/skeleton-loader/skeleton-loader.component';
import { CheckboxComponent } from '../../shared/components/checkbox/checkbox.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CardComponent, SkeletonLoaderComponent, CheckboxComponent],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent {
  public readonly web3Service = inject(Web3Service);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  // Trạng thái thống kê tổng quan
  public readonly totalSessions = signal<number>(0);
  public readonly totalDraws = signal<number>(0);
  public readonly totalUsers = signal<number>(0);
  public readonly linkBalance = signal<string>('--');
  public readonly subscriptionId = signal<string>('');
  public readonly recentDraws = signal<any[]>([]);
  public readonly isStatsLoading = signal<boolean>(true);

  // Form dữ liệu bốc thăm
  public eventName = '';
  public description = '';
  public participantsText = '';
  public drawType = 2; // Mặc định: Random Name
  
  // Tùy chọn tiền xử lý danh sách
  public optRemoveDuplicates = true;
  public optTrimSpaces = true;
  public optRemoveEmptyLines = true;

  // Cấu hình các tham số cụ thể cho từng loại quay
  public numMin = 1;
  public numMax = 100;
  public numWinners = 1;
  public diceSides = 6;
  public numTeams = 3;

  // Trạng thái giao dịch
  public isPendingTx = signal<boolean>(false);
  public pendingTxHash = signal<string>('');

  constructor() {
    // Tự động tải thống kê khi cấu hình mạng thay đổi hoặc khi ví kết nối
    effect(() => {
      this.loadBlockchainStats();
    });
  }

  /**
   * Truy vấn lịch sử sự kiện trên blockchain để tính toán số liệu thống kê
   */
  public async loadBlockchainStats() {
    this.isStatsLoading.set(true);
    try {
      const draws = await this.web3Service.getAllDrawSessionsFromEvents();
      this.totalSessions.set(draws.length);

      // Đếm số người dùng (creator) duy nhất
      const uniqueCreators = new Set(draws.map(d => d.creator.toLowerCase()));
      this.totalUsers.set(uniqueCreators.size);

      // Lấy 5 phiên gần nhất làm Recent Draws
      // Gọi RPC sessions để kiểm tra xem đã fulfilled chưa
      const recent = [];
      const limit = Math.min(draws.length, 5);
      
      for (let i = 0; i < limit; i++) {
        const d = draws[i];
        const status = await this.web3Service.getDrawSession(d.requestId);
        recent.push({
          ...d,
          fulfilled: status ? status.fulfilled : false,
          result: status ? status.result : '',
          timestamp: status ? status.timestamp : 0
        });
      }
      this.recentDraws.set(recent);

      // Tính tổng số lượt quay đã hoàn thành (fulfilled)
      // Để tránh gọi RPC quá nhiều gây chậm, ta tạm thời lấy số lượng phiên có kết quả
      let completedCount = 0;
      const contract = this.web3Service.getContract(false);
      
      // Quét các event DrawFulfilled để biết chính xác tổng số lần VRF callback thành công
      try {
        const filter = contract['filters']['DrawFulfilled']();
        const fulfilledEvents = await contract.queryFilter(filter, 0, 'latest');
        completedCount = fulfilledEvents.length;
      } catch (err) {
        // Fallback đếm thủ công nếu RPC bị giới hạn range
        completedCount = recent.filter(r => r.fulfilled).length;
      }
      this.totalDraws.set(completedCount);

      // Lấy số dư LINK từ VRF Subscription
      const linkInfo = await this.web3Service.getLinkSubscriptionBalance();
      if (linkInfo) {
        this.linkBalance.set(linkInfo.balance);
        this.subscriptionId.set(linkInfo.subscriptionId);
      } else {
        this.linkBalance.set('N/A');
        this.subscriptionId.set('');
      }

    } catch (err) {
      console.warn('[Dashboard] Tải thống kê blockchain lỗi:', err);
    } finally {
      this.isStatsLoading.set(false);
    }
  }

  /**
   * Xử lý import file CSV chứa danh sách người tham gia
   */
  public onCsvFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const text = e.target.result;
      // Chia dòng bằng ký tự xuống dòng
      const lines = text.split(/\r?\n/);
      
      // Lọc các giá trị trong CSV (bỏ ký tự bao quanh, khoảng trắng)
      const cleanLines = lines.map((l: string) => {
        // Tách theo dấu phẩy hoặc chấm phẩy nếu có cấu trúc cột, lấy cột đầu
        const firstCol = l.split(/[;,]/)[0];
        return firstCol ? firstCol.replace(/['"]/g, '').trim() : '';
      }).filter((l: string) => l !== '');

      this.participantsText = cleanLines.join('\n');
      this.toastService.showToast(`Đã import thành công ${cleanLines.length} người từ CSV!`, 'success');
      // Reset input file
      event.target.value = '';
    };
    reader.readAsText(file);
  }

  /**
   * Tiền xử lý danh sách người tham gia dựa vào tùy chọn checkbox
   */
  public getProcessedParticipants(): string[] {
    if (!this.participantsText.trim()) return [];

    let lines = this.participantsText.split('\n');

    if (this.optTrimSpaces) {
      lines = lines.map(line => line.trim());
    }

    if (this.optRemoveEmptyLines) {
      lines = lines.filter(line => line !== '');
    }

    if (this.optRemoveDuplicates) {
      lines = Array.from(new Set(lines));
    }

    return lines;
  }

  /**
   * Gửi giao dịch bốc thăm lên blockchain
   */
  public async onSubmitDraw() {
    // 1. Kiểm tra đăng nhập ví
    if (!this.web3Service.walletConnected()) {
      this.toastService.showToast('Vui lòng kết nối ví điện tử trước khi bốc thăm!', 'error');
      this.web3Service.connectWallet();
      return;
    }

    // 2. Kiểm tra sai mạng
    if (this.web3Service.isWrongChain()) {
      this.toastService.showToast('Vui lòng chuyển ví sang mạng Arbitrum!', 'error');
      return;
    }

    // 3. Validate dữ liệu bốc thăm
    if (!this.eventName.trim()) {
      this.toastService.showToast('Vui lòng nhập tên phiên bốc thăm!', 'error');
      return;
    }

    const participants = this.getProcessedParticipants();
    
    // Validate theo từng chế độ quay
    if (this.drawType === 1) { // Random Number
      if (this.numMin >= this.numMax) {
        this.toastService.showToast('Số Min phải nhỏ hơn số Max!', 'error');
        return;
      }
    } else if (this.drawType === 2 || this.drawType === 3 || this.drawType === 9) { // Chế độ cần danh sách người
      if (participants.length === 0) {
        this.toastService.showToast('Vui lòng nhập danh sách người tham gia!', 'error');
        return;
      }
      if (this.drawType === 3) { // Multi Winners
        if (this.numWinners <= 0) {
          this.toastService.showToast('Số người thắng phải lớn hơn 0!', 'error');
          return;
        }
        if (this.numWinners > participants.length) {
          this.toastService.showToast('Số người thắng không được lớn hơn tổng số người tham gia!', 'error');
          return;
        }
      } else if (this.drawType === 9) { // Random Team
        if (this.numTeams <= 1) {
          this.toastService.showToast('Số lượng đội phải lớn hơn 1!', 'error');
          return;
        }
        if (this.numTeams > 50) {
          this.toastService.showToast('Chỉ hỗ trợ chia tối đa 50 đội!', 'error');
          return;
        }
      }
    }

    // 4. Chuẩn bị tham số gửi lên contract
    let param1 = 0;
    let param2 = 0;

    if (this.drawType === 1) {
      param1 = this.numMin;
      param2 = this.numMax;
    } else if (this.drawType === 2) {
      param1 = participants.length;
      param2 = 0;
    } else if (this.drawType === 3) {
      param1 = participants.length;
      param2 = this.numWinners;
    } else if (this.drawType === 5) {
      param1 = this.diceSides;
      param2 = 0;
    } else if (this.drawType === 9) {
      param1 = participants.length;
      param2 = this.numTeams;
    }

    // Gộp mô tả vào eventName ngăn cách bởi dấu | để tối ưu gas
    const fullEventName = this.description.trim() 
      ? `${this.eventName.trim()} | ${this.description.trim()}`
      : this.eventName.trim();

    // 5. Thực hiện gửi Transaction Web3
    this.isPendingTx.set(true);
    this.pendingTxHash.set('');

    try {
      const requestId = await this.web3Service.requestDraw(
        this.drawType,
        param1,
        param2,
        fullEventName,
        participants
      );

      this.toastService.showToast('Gửi yêu cầu bốc thăm thành công!', 'success');
      this.isPendingTx.set(false);
      
      // Chuyển hướng sang trang chi tiết phiên bốc thăm để đợi kết quả từ Chainlink VRF
      this.router.navigate(['/detail', requestId]);

    } catch (err: any) {
      this.isPendingTx.set(false);
      let errMsg = err.message || 'Giao dịch thất bại.';
      if (errMsg.includes('user rejected')) {
        errMsg = 'Bạn đã từ chối ký giao dịch trên ví.';
      } else if (errMsg.includes('BlockLimitNotPassed')) {
        errMsg = 'Bạn đang gửi yêu cầu quá nhanh. Vui lòng đợi 1 block tiếp theo.';
      }
      this.toastService.showToast(errMsg, 'error');
    }
  }

  /**
   * Helper hiển thị tên loại quay
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
