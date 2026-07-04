import { Component, inject, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Web3Service } from '../../core/services/web3.service';
import { CardComponent } from '../../shared/components/card/card.component';
import { SpinnerComponent } from '../../shared/components/spinner/spinner.component';
import { SkeletonLoaderComponent } from '../../shared/components/skeleton-loader/skeleton-loader.component';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CardComponent, SpinnerComponent, SkeletonLoaderComponent],
  templateUrl: './history.component.html'
})
export class HistoryComponent {
  public readonly web3Service = inject(Web3Service);
  public readonly Math = Math;

  // Danh sách thô từ Event logs
  public readonly rawDraws = signal<any[]>([]);
  public readonly isLoading = signal<boolean>(true);

  // Bộ lọc
  public filterSearch = '';
  public filterCreator = '';
  public filterType = 0; // 0: Tất cả

  // Phân trang
  public currentPage = 1;
  public readonly pageSize = 10;

  // Lọc dữ liệu bằng Computed Signals để tối ưu hóa hiệu năng
  public readonly filteredDraws = computed(() => {
    let result = this.rawDraws();

    // Lọc theo từ khóa tìm kiếm (tên phiên)
    if (this.filterSearch.trim()) {
      const q = this.filterSearch.toLowerCase().trim();
      result = result.filter(d => d.eventName.toLowerCase().includes(q));
    }

    // Lọc theo người tạo (creator address)
    if (this.filterCreator.trim()) {
      const creator = this.filterCreator.toLowerCase().trim();
      result = result.filter(d => d.creator.toLowerCase().includes(creator));
    }

    // Lọc theo loại bốc thăm
    if (Number(this.filterType) !== 0) {
      const type = Number(this.filterType);
      result = result.filter(d => d.drawType === type);
    }

    return result;
  });

  // Dữ liệu hiển thị trên trang hiện tại
  public readonly paginatedDraws = computed(() => {
    const list = this.filteredDraws();
    const startIndex = (this.currentPage - 1) * this.pageSize;
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
      this.currentPage = 1; // Reset về trang 1
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
    this.currentPage = page;
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
