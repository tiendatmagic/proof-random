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
  public selectedSkin = ''; // '', 'LuckyWheel', 'Racing', 'MysteryBox', 'BauCua', 'ScratchCard', 'Vietlott', 'Plinko', 'SlotMachine', 'CardDraw', 'OanTuTi'

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
    } else if (skin === 'OanTuTi') {
      this.numMin = 1;
      this.numMax = 3;
    } else if (skin === 'Bingo') {
      this.numMin = 1;
      this.numMax = 90;
    } else if (skin === 'WhatToEat') {
      if (!this.participantsText.trim() || this.participantsText.includes('Nguyễn Văn A') || this.participantsText.includes('Fool')) {
        this.participantsText = 'Cơm tấm Sườn Bì Chả\nPhở Bò Tái Nạm\nBún Chả Hà Nội\nGà Rán KFC\nBánh Mì Thịt Nướng\nPizza Hải Sản\nBún Đậu Mắm Tôm\nSushi Nhật Bản\nLẩu Thái Cay CoCo';
      }
    } else if (skin === 'Tarot') {
      if (!this.participantsText.trim() || this.participantsText.includes('Nguyễn Văn A') || this.participantsText.includes('Cơm tấm')) {
        this.participantsText = 'The Fool (Chàng Khờ)\nThe Magician (Nhà Ảo Thuật)\nThe High Priestess (Nữ Tư Tế)\nThe Empress (Nữ Hoàng)\nThe Emperor (Hoàng Đế)\nThe Hierophant (Giáo Hoàng)\nThe Lovers (Tình Nhân)\nThe Chariot (Chiến Xa)\nStrength (Sức Mạnh)\nThe Hermit (Ẩn Sĩ)\nWheel of Fortune (Vòng Quay Số Phận)\nJustice (Công Lý)\nThe Hanged Man (Kẻ Treo)\nDeath (Tử Thần)\nTemperance (Tiết Độ)\nThe Devil (Ác Quỷ)\nThe Tower (Tòa Tháp)\nThe Star (Ngôi Sao)\nThe Moon (Mặt Trăng)\nThe Sun (Mặt Trời)\nJudgement (Phán Xét)\nThe World (Thế Giới)';
      }
    } else {
      // Nếu quay lại các chế độ thông thường mà đang chứa mẫu đặc biệt, reset về rỗng
      if (this.participantsText.includes('Cơm tấm Sườn Bì Chả') || this.participantsText.includes('The Fool')) {
        this.participantsText = '';
      }
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
   * Truy vấn lịch sử sự kiện trên blockchain để tính toán số liệu thống kê (có sử dụng Cache)
   */
  public async loadBlockchainStats() {
    this.isStatsLoading.set(true);
    try {
      const stats = await this.web3Service.getDashboardStats(false);
      if (stats) {
        this.totalSessions.set(stats.totalSessions);
        this.totalDraws.set(stats.totalDraws);
        this.linkBalance.set(stats.linkBalance);
        this.subscriptionId.set(stats.subscriptionId);
        this.recentDraws.set(stats.recentDraws);
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

    let participants = this.getProcessedParticipants();

    // Tự động gán số người thắng bằng tổng số người tham gia đối với chế độ Hàng đợi và Sơ đồ chỗ ngồi
    if (this.selectedSkin === 'Sequence' || this.selectedSkin.startsWith('Seating')) {
      this.numWinners = participants.length;
    } else if (this.selectedSkin === 'Bingo') {
      // Tự động sinh danh sách 90 bóng: ["1", "2", ..., "90"] để hợp lệ hóa với yêu cầu contract đối với drawType = 3
      participants = Array.from({ length: 90 }, (_, i) => (i + 1).toString());
    }

    // Validate theo từng chế độ quay
    if (this.selectedSkin === 'Bingo') {
      if (this.numWinners <= 0 || this.numWinners > 90) {
        this.toastService.showToast('Số lượng bóng cần quay phải từ 1 đến 90!', 'error');
        return;
      }
    } else if (this.drawType === 1) { // Random Number
      if (this.numMin >= this.numMax) {
        this.toastService.showToast('Số Min phải nhỏ hơn số Max!', 'error');
        return;
      }
      if (this.numWinners > 1) {
        const rangeSize = this.numMax - this.numMin + 1;
        if (this.numWinners > rangeSize) {
          this.toastService.showToast('Số lượng số cần quay không được lớn hơn tổng số trong khoảng (Max - Min + 1)!', 'error');
          return;
        }
        if (rangeSize > 1000) {
          this.toastService.showToast('Khoảng giới hạn số (Max - Min + 1) không được vượt quá 1000 khi quay nhiều số cùng lúc để tiết kiệm gas!', 'error');
          return;
        }
      } else if (this.numWinners <= 0) {
        this.toastService.showToast('Số lượng số cần quay phải lớn hơn 0!', 'error');
        return;
      }
    } else if (this.drawType === 2 || this.drawType === 3 || this.drawType === 9) { // Chế độ cần danh sách người
      if (participants.length === 0) {
        this.toastService.showToast('Vui lòng nhập danh sách người tham gia / món ăn!', 'error');
        return;
      }

      const isMultiWhatToEat = (this.selectedSkin === 'WhatToEat' && this.numWinners > 1);
      const isMultiTarot = (this.selectedSkin === 'Tarot' && this.numWinners > 1);
      if (this.drawType === 3 || isMultiWhatToEat || isMultiTarot) { // Multi Winners hoặc WhatToEat/Tarot chọn nhiều món/lá bài
        if (this.numWinners <= 0) {
          this.toastService.showToast('Số lượng cần bốc thăm phải lớn hơn 0!', 'error');
          return;
        }
        if (this.numWinners > participants.length) {
          this.toastService.showToast('Số lượng bốc thăm không được lớn hơn tổng số lựa chọn!', 'error');
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
    } else if (this.drawType === 8) { // Random Letter
      if (this.numWinners <= 0 || this.numWinners > 26) {
        this.toastService.showToast('Số lượng chữ cái cần quay phải từ 1 đến 26!', 'error');
        return;
      }
    } else if (this.drawType === 5 && this.selectedSkin !== 'BauCua') { // Dice Roll
      if (this.numWinners <= 0 || this.numWinners > this.diceSides) {
        this.toastService.showToast(`Số lượng xúc xắc cần tung phải từ 1 đến ${this.diceSides}!`, 'error');
        return;
      }
    }

    // 4. Chuẩn bị tham số gửi lên contract
    let param1 = 0;
    let param2 = 0;
    let drawTypeToSend = this.drawType;
    let skinToSend = this.selectedSkin;

    if (this.selectedSkin === 'WhatToEat') {
      if (this.numWinners > 1) {
        drawTypeToSend = 3;
        param1 = participants.length;
        param2 = this.numWinners;
      } else {
        drawTypeToSend = 2;
        param1 = participants.length;
        param2 = 0;
      }
    } else if (this.selectedSkin === 'Bingo') {
      if (this.numWinners > 1) {
        drawTypeToSend = 3;
        param1 = 90;
        param2 = this.numWinners;
      } else {
        drawTypeToSend = 1;
        param1 = 1;
        param2 = 90;
      }
    } else if (this.selectedSkin === 'Tarot') {
      if (this.numWinners > 1) {
        drawTypeToSend = 3;
        param1 = participants.length;
        param2 = this.numWinners;
      } else {
        drawTypeToSend = 2;
        param1 = participants.length;
        param2 = 0;
      }
    } else {
      if (this.drawType === 1) {
        if (this.numWinners > 1) {
          drawTypeToSend = 3;
          param1 = this.numMax - this.numMin + 1;
          param2 = this.numWinners;
          participants = Array.from({ length: param1 }, (_, i) => (this.numMin + i).toString());
        } else {
          param1 = this.numMin;
          param2 = this.numMax;
        }
      } else if (this.drawType === 2) {
        param1 = participants.length;
        param2 = 0;
      } else if (this.drawType === 3) {
        param1 = participants.length;
        param2 = this.numWinners;
      } else if (this.drawType === 5) {
        if (this.numWinners > 1) {
          drawTypeToSend = 3;
          param1 = this.diceSides;
          param2 = this.numWinners;
          participants = Array.from({ length: this.diceSides }, (_, i) => (i + 1).toString());
          skinToSend = 'Dice';
        } else {
          param1 = this.diceSides;
          param2 = 0;
        }
      } else if (this.drawType === 8) {
        if (this.numWinners > 1) {
          drawTypeToSend = 3;
          param1 = 26;
          param2 = this.numWinners;
          participants = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
          skinToSend = 'RandomLetter';
        } else {
          param1 = 0;
          param2 = 0;
        }
      } else if (this.drawType === 9) {
        param1 = participants.length;
        param2 = this.numTeams;
      }
    }

    // Gộp mô tả vào eventName ngăn cách bởi dấu | để tối ưu gas
    let eventNameToSend = this.eventName.trim();
    if (skinToSend) {
      eventNameToSend = `[Skin:${skinToSend}] ${eventNameToSend}`;
    }
    const fullEventName = this.description.trim()
      ? `${eventNameToSend} | ${this.description.trim()}`
      : eventNameToSend;

    // 5. Thực hiện gửi Transaction Web3
    this.isPendingTx.set(true);
    this.pendingTxHash.set('');

    try {
      const requestId = await this.web3Service.requestDraw(
        drawTypeToSend,
        param1,
        param2,
        fullEventName,
        participants
      );

      this.toastService.showToast('Gửi yêu cầu bốc thăm thành công!', 'success');
      this.isPendingTx.set(false);

      // Xóa cache Dashboard Stats của chain hiện tại để khi quay lại Dashboard số liệu được cập nhật mới nhất
      this.web3Service.clearDashboardStatsCache(this.web3Service.configuredChainId().toString());

      // Chuyển hướng sang trang chi tiết phiên bốc thăm để đợi kết quả từ Chainlink VRF
      this.router.navigate(['/detail', requestId], { queryParams: { fresh: 'true' } });

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
    if (skin && skin.startsWith('Seating')) return 'Sơ đồ chỗ ngồi';

    // Game skins ưu tiên hiển thị trước
    const skins: Record<string, string> = {
      LuckyWheel: 'Vòng quay may mắn',
      Racing: 'Đua xe ngẫu nhiên',
      MysteryBox: 'Hộp quà bí ẩn',
      BauCua: 'Bầu Cua Tôm Cá',
      ScratchCard: 'Vé số cào',
      Vietlott: 'Xổ số Vietlott',
      Plinko: 'Thả bóng Plinko',
      SlotMachine: 'Quay Slot Machine',
      CardDraw: 'Bốc bài tây',
      OanTuTi: 'Oản tù tì',
      Sequence: 'Thứ tự ngẫu nhiên',
      WhatToEat: 'Hôm nay ăn gì?',
      Tarot: 'Rút bài Tarot',
      Bingo: 'Quay số Bingo'
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
        case 'Plinko':
          // Plinko: Xanh cyan neon công nghệ
          return 'bg-cyan-500/10 dark:bg-cyan-950/20 text-cyan-600 dark:text-cyan-400 border-cyan-200/30 dark:border-cyan-800/30';
        case 'SlotMachine':
          // Slot Machine: Vàng cam may mắn
          return 'bg-orange-500/10 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 border-orange-200/30 dark:border-orange-800/30';
        case 'CardDraw':
          // Bốc bài tây: Hồng Neon
          return 'bg-fuchsia-500/10 dark:bg-fuchsia-950/20 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-200/30 dark:border-fuchsia-800/30';
        case 'OanTuTi':
          // Oản tù tì: Xanh lục chàm
          return 'bg-indigo-500/10 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border-indigo-200/30 dark:border-indigo-800/30';
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
