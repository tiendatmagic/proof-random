import { Component, inject, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Web3Service } from '../../core/services/web3.service';
import { CardComponent } from '../../shared/components/card/card.component';
import { SkeletonLoaderComponent } from '../../shared/components/skeleton-loader/skeleton-loader.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CardComponent, SkeletonLoaderComponent, SelectComponent],
  templateUrl: './history.component.html'
})
export class HistoryComponent {
  public readonly web3Service = inject(Web3Service);
  public readonly Math = Math;

  // Cấu hình các tùy chọn lọc loại bốc thăm cho Custom Select
  public readonly filterOptions: SelectOption[] = [
    { value: 0, label: 'Tất cả chế độ' },
    { value: 1,  label: 'Quay số ngẫu nhiên (Random Number)' },
    { value: 2,  label: 'Chọn 1 tên ngẫu nhiên (Random Name)' },
    { value: 3,  label: 'Nhiều người thắng (Multiple Winners)' },
    { value: 4,  label: 'Lật đồng xu (Coin Flip)' },
    { value: 5,  label: 'Quay xúc xắc (Dice Roll)' },
    { value: 6,  label: 'Chẵn / Lẻ (Even / Odd)' },
    { value: 7,  label: 'Màu sắc ngẫu nhiên (Random Color)' },
    { value: 8,  label: 'Chữ cái ngẫu nhiên (Random Letter)' },
    { value: 9,  label: 'Chia đội ngẫu nhiên (Random Team)' },
    // --- Game Skins ---
    { value: 'LuckyWheel',   label: 'Vòng quay may mắn (Lucky Wheel)' },
    { value: 'Racing',       label: 'Đua xe ngẫu nhiên (Random Racing)' },
    { value: 'MysteryBox',   label: 'Hộp quà bí ẩn (Mystery Box)' },
    { value: 'BauCua',       label: 'Bầu Cua Tôm Cá (Gourd-Crab-Fish)' },
    { value: 'ScratchCard',  label: 'Vé số cào (Scratch Card)' },
    { value: 'Vietlott',     label: 'Xổ số Vietlott (Power/Mega/Keno)' },
  ];

  // Danh sách thô từ Event logs
  public readonly rawDraws = signal<any[]>([]);
  public readonly isLoading = signal<boolean>(true);

  // Bộ lọc — dùng signal để computed() tự recompute
  public readonly filterSearch = signal('');
  public readonly filterCreator = signal('');
  public readonly filterType = signal<number | string>(0);

  // Phân trang — dùng signal
  public readonly currentPage = signal(1);
  public readonly pageSize = 10;

  // Lọc dữ liệu bằng Computed Signals
  public readonly filteredDraws = computed(() => {
    let result = this.rawDraws();

    if (this.filterSearch().trim()) {
      const q = this.filterSearch().toLowerCase().trim();
      result = result.filter(d => d.eventName.toLowerCase().includes(q));
    }

    if (this.filterCreator().trim()) {
      const creator = this.filterCreator().toLowerCase().trim();
      result = result.filter(d => d.creator.toLowerCase().includes(creator));
    }

    const type = this.filterType();
    if (type !== 0) {
      if (typeof type === 'string') {
        result = result.filter(d => d.skin === type);
      } else {
        result = result.filter(d => d.drawType === type && !d.skin);
      }
    }

    return result;
  });

  // Dữ liệu hiển thị trên trang hiện tại
  public readonly paginatedDraws = computed(() => {
    const list = this.filteredDraws();
    const startIndex = (this.currentPage() - 1) * this.pageSize;
    return list.slice(startIndex, startIndex + this.pageSize);
  });

  // Tính tổng số trang
  public readonly totalPages = computed(() => {
    return Math.ceil(this.filteredDraws().length / this.pageSize) || 1;
  });

  constructor() {
    effect(() => {
      this.loadAllHistory();
    });
  }

  /**
   * Quét sự kiện blockchain để lấy lịch sử bốc thăm
   */
  public async loadAllHistory() {
    this.isLoading.set(true);
    try {
      const draws = await this.web3Service.getAllDrawSessionsFromEvents();
      this.rawDraws.set(draws);
      this.currentPage.set(1); // Reset về trang 1
    } catch (err) {
      console.warn('[History] Quét lịch sử bốc thăm lỗi:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Chuyển đổi trang lịch sử
   */
  public setPage(page: number) {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
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
        return 'bg-slate-100 dark:bg-slate-950/40 text-slate-500 border-slate-200/20';
    }
  }
}
