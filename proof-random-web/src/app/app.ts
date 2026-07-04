import { Component, inject, signal, HostListener, ElementRef } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Web3Service } from './core/services/web3.service';
import { ThemeService } from './core/services/theme.service';
import { ToastService } from './core/services/toast.service';
import { ToastComponent } from './shared/components/toast/toast.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, ToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  public readonly web3Service = inject(Web3Service);
  public readonly themeService = inject(ThemeService);
  private readonly toastService = inject(ToastService);
  private readonly elementRef = inject(ElementRef);

  // Điều khiển hiển thị dropdown thông tin ví
  public readonly isWalletDropdownOpen = signal<boolean>(false);

  // Điều khiển hiển thị dropdown chọn mạng
  public readonly isChainDropdownOpen = signal<boolean>(false);

  // Điều khiển hiển thị sidebar trên mobile
  public readonly isMobileMenuOpen = signal<boolean>(false);

  /**
   * Mở hoặc đóng menu điều hướng trên mobile
   */
  public toggleMobileMenu() {
    this.isMobileMenuOpen.update(v => !v);
  }

  /**
   * Đóng menu mobile khi người dùng click chọn trang
   */
  public closeMobileMenu() {
    this.isMobileMenuOpen.set(false);
  }

  /**
   * Đăng nhập ví
   */
  public connectWallet() {
    this.web3Service.connectWallet();
  }

  /**
   * Đăng xuất ví
   */
  public disconnectWallet() {
    this.web3Service.disconnectWallet();
    this.isWalletDropdownOpen.set(false);
  }

  /**
   * Sao chép địa chỉ ví vào clipboard
   */
  public copyWalletAddress() {
    const addr = this.web3Service.currentAccount();
    if (addr) {
      navigator.clipboard.writeText(addr);
      this.toastService.showToast('Đã sao chép địa chỉ ví!', 'success');
    }
    this.isWalletDropdownOpen.set(false);
  }

  /**
   * Mở modal chi tiết ví của AppKit
   */
  public openWalletModal() {
    this.web3Service.openWalletModal();
    this.isWalletDropdownOpen.set(false);
  }

  /**
   * Lắng nghe sự kiện click toàn cục để tự động đóng dropdown ví khi click outside
   */
  @HostListener('document:click', ['$event'])
  public onClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (
      !this.elementRef.nativeElement.querySelector('#wallet-dropdown-container')?.contains(target)
    ) {
      this.isWalletDropdownOpen.set(false);
    }
    if (
      !this.elementRef.nativeElement.querySelector('#chain-dropdown-container')?.contains(target)
    ) {
      this.isChainDropdownOpen.set(false);
    }
  }

  /**
   * Chuyển đổi mạng lưới nhanh sang Arbitrum Sepolia/One
   */
  public switchNetwork(chainId: string) {
    this.web3Service.switchNetwork(chainId);
    this.isChainDropdownOpen.set(false);
  }
}
