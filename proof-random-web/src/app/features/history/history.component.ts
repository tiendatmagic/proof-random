import { Component, inject, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { Web3Service } from '../../core/services/web3.service';
import { CardComponent } from '../../shared/components/card/card.component';
import { SkeletonLoaderComponent } from '../../shared/components/skeleton-loader/skeleton-loader.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CardComponent, SkeletonLoaderComponent, SelectComponent, PaginationComponent],
  templateUrl: './history.component.html'
})
export class HistoryComponent {
  public readonly web3Service = inject(Web3Service);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  public readonly Math = Math;

  // Cấu hình các tùy chọn lọc loại bốc thăm cho Custom Select
  public readonly filterOptions: SelectOption[] = [
    { value: 0, label: 'Tất cả chế độ' },
    // --- 9 Chế độ bốc thăm cơ bản (drawType) ---
    { value: 1,  label: 'Quay số ngẫu nhiên (Random Number)' },
    { value: 2,  label: 'Chọn 1 tên ngẫu nhiên (Random Name)' },
    { value: 3,  label: 'Nhiều người thắng (Multiple Winners)' },
    { value: 4,  label: 'Lật đồng xu (Coin Flip)' },
    { value: 5,  label: 'Quay xúc xắc (Dice Roll)' },
    { value: 6,  label: 'Chẵn / Lẻ (Even / Odd)' },
    { value: 7,  label: 'Màu sắc ngẫu nhiên (Random Color)' },
    { value: 8,  label: 'Chữ cái ngẫu nhiên (Random Letter)' },
    { value: 9,  label: 'Chia đội ngẫu nhiên (Random Team)' },
    // --- Game Skins (drawType 1 hoặc 2 có skin) ---
    { value: 'RandomNumber', label: '🎲 Quay số nhiều lần (RandomNumber skin)' },
    { value: 'LuckyWheel',   label: '🎡 Vòng quay may mắn (Lucky Wheel)' },
    { value: 'Racing',       label: '🏎️ Đua xe ngẫu nhiên (Random Racing)' },
    { value: 'MysteryBox',   label: '🎁 Hộp quà bí ẩn (Mystery Box)' },
    { value: 'BauCua',       label: '🦀 Bầu Cua Tôm Cá (Gourd-Crab-Fish)' },
    { value: 'ScratchCard',  label: '🎟️ Vé số cào (Scratch Card)' },
    { value: 'Vietlott',     label: '🍀 Xổ số Vietlott (Power/Mega/Keno)' },
    { value: 'Plinko',       label: '🎳 Thả bóng Plinko (Plinko Board)' },
    { value: 'SlotMachine',  label: '🎰 Quay Slot Machine (Slot Reels)' },
    { value: 'CardDraw',     label: '🃏 Bốc bài tây (Card Draw)' },
    { value: 'OanTuTi',      label: '✊ Oản tù tì (Rock Paper Scissors)' },
    { value: 'Sequence',     label: '🔢 Thứ tự ngẫu nhiên (Random Sequence)' },
    { value: 'Seating',      label: '🪑 Sơ đồ chỗ ngồi (Seating Chart)' },
    { value: 'WhatToEat',    label: '🍜 Hôm nay ăn gì? (What to Eat Picker)' },
    { value: 'Tarot',        label: '🔮 Rút bài Tarot (Tarot Card Reader)' },
    { value: 'Bingo',        label: '📢 Quay số Bingo (Bingo Caller)' },
    { value: 'Dice',         label: '🎲 Xúc xắc nhiều lần (Dice skin)' },
    { value: 'CoinFlip',     label: '🪙 Đồng xu nhiều lần (CoinFlip skin)' },
    { value: 'RandomLetter', label: '🔤 Chữ cái nhiều lần (RandomLetter skin)' }
  ];

  // Danh sách thô từ Event logs hoặc danh sách phân trang từ blockchain
  public readonly rawDraws = signal<any[]>([]);
  public readonly isLoading = signal<boolean>(true);

  // Bộ lọc — dùng signal để computed() tự recompute
  public readonly filterSearch = signal('');
  public readonly filterCreator = signal('');
  public readonly filterType = signal<number | string>(0);

  // Phân trang — dùng signal
  public readonly currentPage = signal(1);
  public readonly pageSize = 10;

  // Trỏ trực tiếp tới cache của Web3Service để duy trì cache xuyên suốt route
  public get allDrawsCache(): any[] {
    return this.web3Service.historyCacheDraws;
  }
  public get hasFullScan(): boolean {
    return this.web3Service.historyHasFullScan;
  }

  // Tổng số lượng phiên trên blockchain (dùng cho phân trang on-chain)
  public readonly totalOnChainDraws = signal<number>(0);

  // Nhận diện trạng thái đang có bộ lọc hoạt động
  public readonly isFiltering = computed(() => {
    return !!this.filterSearch().trim() || !!this.filterCreator().trim() || this.filterType() !== 0;
  });

  // Lọc dữ liệu bằng Computed Signals
  public readonly filteredDraws = computed(() => {
    let result = this.isFiltering() ? this.allDrawsCache : this.rawDraws();

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
        // Với Seating, RandomNumber dùng startsWith vì skin có thể là 'Seating-4' hoặc 'RandomNumber-10'
        if (type === 'Seating' || type === 'RandomNumber') {
          result = result.filter(d => d.skin && d.skin.startsWith(type));
        } else {
          result = result.filter(d => d.skin === type);
        }
      } else {
        // DrawType thuần (không có skin game)
        result = result.filter(d => d.drawType === type && !d.skin);
      }
    }

    return result;
  });

  // Dữ liệu hiển thị trên trang hiện tại
  public readonly paginatedDraws = computed(() => {
    const list = this.filteredDraws();
    if (this.isFiltering()) {
      const startIndex = (this.currentPage() - 1) * this.pageSize;
      return list.slice(startIndex, startIndex + this.pageSize);
    } else {
      // Chế độ mặc định: rawDraws đã chứa đúng 10 phiên được phân trang trực tiếp từ blockchain
      return list;
    }
  });

  // Tính tổng số trang
  public readonly totalPages = computed(() => {
    if (this.isFiltering()) {
      return Math.ceil(this.filteredDraws().length / this.pageSize) || 1;
    } else {
      return Math.ceil(this.totalOnChainDraws() / this.pageSize) || 1;
    }
  });

  constructor() {
    // Đăng ký queryParams để cập nhật currentPage từ URL
    this.route.queryParams.subscribe(params => {
      const page = Number(params['page']);
      if (page && page > 0) {
        if (this.currentPage() !== page) {
          this.currentPage.set(page);
        }
      } else {
        // Tự động gán param page=1 nếu chưa có
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { page: 1 },
          queryParamsHandling: 'merge',
          replaceUrl: true
        });
      }
    });

    effect(() => {
      // Đăng ký các signal đổi giá trị để kích hoạt tải lại dữ liệu tương ứng
      this.currentPage();
      this.filterSearch();
      this.filterCreator();
      this.filterType();

      this.loadHistory();
    });
  }

  /**
   * Tải dữ liệu lịch sử bốc thăm (tự động phân trang hoặc quét full tùy theo trạng thái bộ lọc)
   */
  public async loadHistory() {
    const page = this.currentPage();
    
    // Kiểm tra xem đã có cache phân trang hoặc cache sự kiện đầy đủ chưa
    const hasCache = this.isFiltering()
      ? this.web3Service.historyHasFullScan
      : this.web3Service.hasPaginatedDrawsCache(page, this.pageSize);

    // Chỉ hiển thị skeleton loader khi không có sẵn cache để tránh nhấp nháy giao diện
    if (!hasCache) {
      this.isLoading.set(true);
    }

    try {
      if (this.isFiltering()) {
        // Tải danh sách đã quét từ event logs (đã tự động có cache trong Web3Service)
        const draws = await this.web3Service.getAllDrawSessionsFromEvents(false);
        // Cập nhật rawDraws ảo để kích hoạt computed filteredDraws chạy lại
        this.rawDraws.set([...draws]);
      } else {
        // Chế độ mặc định: tải đúng 10 phiên thuộc trang hiện tại trực tiếp từ Blockchain (có sử dụng cache phân trang)
        const result = await this.web3Service.getDrawSessionsPaginated(page, this.pageSize, false);
        this.rawDraws.set(result.draws);
        this.totalOnChainDraws.set(result.total);
      }
    } catch (err) {
      console.warn('[History] Tải lịch sử bốc thăm lỗi:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Nút làm mới dữ liệu: xóa bộ nhớ cache và tải lại từ đầu từ blockchain
   */
  public async loadAllHistory() {
    this.web3Service.clearHistoryCache();
    if (this.currentPage() !== 1) {
      this.setPage(1);
    } else {
      await this.loadHistory();
    }
  }

  /**
   * Chuyển đổi trang lịch sử
   */
  public setPage(page: number) {
    if (page < 1 || page > this.totalPages()) return;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page },
      queryParamsHandling: 'merge'
    });
  }

  private isNumberWinners(type: number, skin?: string, result?: any): boolean {
    if (type === 3) {
      if (skin && skin.startsWith('RandomNumber')) return true;
      if (result && typeof result === 'string') {
        const clean = result.trim();
        if (clean && /^\d+(,\d+)*$/.test(clean)) return true;
      }
    }
    return false;
  }

  /**
   * Helper hiển thị tên loại bốc thăm
   */
  public getDrawTypeName(type: number, skin?: string, result?: any): string {
    if (skin && skin.startsWith('RandomNumber')) return 'Quay số ngẫu nhiên';
    if (this.isNumberWinners(type, skin, result)) return 'Quay số ngẫu nhiên';
    if (skin && skin.startsWith('Seating')) return 'Sơ đồ chỗ ngồi';

    // Game skins ưu tiên hiển thị trước
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

  /**
   * Trả về danh sách class Tailwind cho badge tùy theo loại bốc thăm/skin
   */
  public getDrawTypeBadgeClass(type: number, skin?: string, result?: any): string {
    // 1. Nhóm Game Skins (Đặc biệt) -> Dùng các tông màu Neon nổi bật
    if (skin) {
      if (skin.startsWith('RandomNumber')) {
        return 'bg-sky-500/10 dark:bg-sky-950/20 text-sky-600 dark:text-sky-400 border-sky-200/30 dark:border-sky-800/30';
      }
      if (skin.startsWith('Seating')) {
        // Sơ đồ chỗ ngồi: Xanh ngọc (Teal)
        return 'bg-teal-500/10 dark:bg-teal-950/20 text-teal-600 dark:text-teal-400 border-teal-200/30 dark:border-teal-800/30';
      }

      switch (skin) {
        case 'CoinFlip':
          // Lật đồng xu: Xanh ngọc may mắn
          return 'bg-teal-500/10 dark:bg-teal-950/20 text-teal-600 dark:text-teal-400 border-teal-200/30 dark:border-teal-800/30';
        case 'Dice':
          // Xúc xắc: Xanh ngọc may mắn
          return 'bg-teal-500/10 dark:bg-teal-950/20 text-teal-600 dark:text-teal-400 border-teal-200/30 dark:border-teal-800/30';
        case 'RandomLetter':
          // Chữ cái: Tím Indigo sáng tạo
          return 'bg-indigo-500/10 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border-indigo-200/30 dark:border-indigo-800/30';
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
        case 'Sequence':
          // Thứ tự ngẫu nhiên: Màu tím chàm (Indigo)
          return 'bg-indigo-500/10 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border-indigo-200/30 dark:border-indigo-800/30';
        case 'WhatToEat':
          // Hôm nay ăn gì: Màu hồng rose
          return 'bg-rose-500/10 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-200/30 dark:border-rose-800/30';
        default:
          return 'bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 border-purple-200/30 dark:border-purple-800/30';
      }
    }

    if (this.isNumberWinners(type, skin, result)) {
      return 'bg-sky-500/10 dark:bg-sky-950/20 text-sky-600 dark:text-sky-400 border-sky-200/30 dark:border-sky-800/30';
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
