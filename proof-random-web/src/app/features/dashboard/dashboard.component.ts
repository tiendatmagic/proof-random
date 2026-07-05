import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Web3Service } from '../../core/services/web3.service';
import { ToastService } from '../../core/services/toast.service';
import { CardComponent } from '../../shared/components/card/card.component';
import { SkeletonLoaderComponent } from '../../shared/components/skeleton-loader/skeleton-loader.component';
import { CheckboxComponent } from '../../shared/components/checkbox/checkbox.component';
import { DrawConfigPanelComponent } from './components/draw-config-panel/draw-config-panel.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    RouterLink, 
    CardComponent, 
    SkeletonLoaderComponent, 
    CheckboxComponent,
    DrawConfigPanelComponent
  ],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent {
  public readonly web3Service = inject(Web3Service);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  // Trạng thái thống kê tổng quan
  public readonly totalSessions = signal<number>(0);
  public readonly totalDraws = signal<number>(0);
  public readonly linkBalance = signal<string>('--');
  public readonly subscriptionId = signal<string>('');
  public readonly recentDraws = signal<any[]>([]);
  public readonly isStatsLoading = signal<boolean>(true);

  // Form dữ liệu bốc thăm
  public eventName = '';
  public description = '';
  public participantsText = '';
  public drawType = 2; // Mặc định: Random Name
  public selectedSkin = ''; // '', 'LuckyWheel', 'Racing', 'MysteryBox', 'BauCua', 'ScratchCard'
  
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
    this.initDefaultEventName();
    
    // Tự động tải thống kê khi cấu hình mạng thay đổi hoặc khi ví kết nối
    effect(() => {
      this.loadBlockchainStats();
    });
  }

  /**
   * Chọn chế độ quay và loại giao diện tương ứng
   */
  public selectMode(type: number, skin: string = '') {
    this.drawType = type;
    this.selectedSkin = skin;
    
    if (skin === 'BauCua') {
      this.diceSides = 6;
    } else if (skin === 'ScratchCard') {
      this.numMin = 1;
      this.numMax = 100;
    } else if (skin === 'Vietlott') {
      this.numMin = 1;
      this.numMax = 80;
    }
  }

  /**
   * Tạo tên phiên bốc thăm mặc định dựa trên ngày giờ hiện tại
   */
  public initDefaultEventName() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    this.eventName = `Phiên bốc thăm ngày ${dateStr} ${timeStr}`;
  }

  /**
   * Truy vấn lịch sử sự kiện trên blockchain để tính toán số liệu thống kê
   */
  public async loadBlockchainStats() {
    this.isStatsLoading.set(true);
    try {
      const draws = await this.web3Service.getAllDrawSessionsFromEvents();
      this.totalSessions.set(draws.length);

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
    let eventNameToSend = this.eventName.trim();
    if (this.selectedSkin) {
      eventNameToSend = `[Skin:${this.selectedSkin}] ${eventNameToSend}`;
    }
    const fullEventName = this.description.trim() 
      ? `${eventNameToSend} | ${this.description.trim()}`
      : eventNameToSend;

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
   * Helper hiển thị tên loại bốc thăm
   */
  public getDrawTypeName(type: number, skin?: string): string {
    // Game skins ưu tiên hiển thị trước
    const skins: Record<string, string> = {
      LuckyWheel:  'Vòng quay may mắn',
      Racing:      'Đua xe ngẫu nhiên',
      MysteryBox:  'Hộp quà bí ẩn',
      BauCua:      'Bầu Cua Tôm Cá',
      ScratchCard: 'Vé số cào',
      Vietlott:    'Xổ số Vietlott',
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

  /**
   * Trả về danh sách class Tailwind cho badge tùy theo loại bốc thăm/skin
   */
  public getDrawTypeBadgeClass(type: number, skin?: string): string {
    // 1. Nhóm Game Skins (Đặc biệt) -> Dùng các tông màu Neon nổi bật
    if (skin) {
      switch (skin) {
        case 'Vietlott':
          // Vietlott: Đỏ cam nổi bật đặc trưng
          return 'bg-red-500/10 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-red-200/30 dark:border-red-800/30';
        case 'LuckyWheel':
          // Vòng quay: Hồng neon thương hiệu
          return 'bg-pink-500/10 dark:bg-pink-950/20 text-pink-600 dark:text-pink-400 border-pink-200/30 dark:border-pink-800/30';
        case 'MysteryBox':
          // Hộp quà: Vàng hổ phách bí ẩn
          return 'bg-amber-500/10 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-200/30 dark:border-amber-800/30';
        case 'BauCua':
          // Bầu cua: Xanh lá cây tự nhiên dân gian
          return 'bg-emerald-500/10 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-200/30 dark:border-emerald-800/30';
        case 'Racing':
          // Đua xe: Xanh dương thể thao tốc độ
          return 'bg-blue-500/10 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-blue-200/30 dark:border-blue-800/30';
        case 'ScratchCard':
          // Vé số cào: Tím Neon quyến rũ
          return 'bg-purple-500/10 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 border-purple-200/30 dark:border-purple-800/30';
        default:
          return 'bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 border-purple-200/30 dark:border-purple-800/30';
      }
    }

    // 2. Nhóm Chế độ bốc thăm cơ bản -> Chia nhóm màu hài hòa
    switch (type) {
      case 1: // Random Number
      case 2: // Random Name
      case 3: // Multiple Winners
        // Các trò chơi chọn số / chọn người: Xanh dương công nghệ sạch sẽ
        return 'bg-sky-500/10 dark:bg-sky-950/20 text-sky-600 dark:text-sky-400 border-sky-200/30 dark:border-sky-800/30';
      
      case 4: // Coin Flip
      case 5: // Dice Roll
      case 6: // Even/Odd
        // Các trò chơi may rủi nhị phân / súc sắc: Xanh ngọc may mắn
        return 'bg-teal-500/10 dark:bg-teal-950/20 text-teal-600 dark:text-teal-400 border-teal-200/30 dark:border-teal-800/30';
      
      case 7: // Random Color
      case 8: // Random Letter
      case 9: // Random Team
        // Màu sắc, Chữ cái, Chia đội: Tím Indigo sáng tạo
        return 'bg-indigo-500/10 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border-indigo-200/30 dark:border-indigo-800/30';
      
      default:
        return 'bg-slate-500/10 dark:bg-slate-950/20 text-slate-600 dark:text-slate-400 border-slate-200/30 dark:border-slate-800/30';
    }
  }
}
