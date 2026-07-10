import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Web3Service } from './core/services/web3.service';
import { ToastComponent } from './shared/components/toast/toast.component';
import { NetworkDropdownComponent } from './shared/components/network-dropdown/network-dropdown.component';
import { WalletDropdownComponent } from './shared/components/wallet-dropdown/wallet-dropdown.component';
import { SidebarComponent } from './shared/components/sidebar/sidebar.component';
import { WrongChainBannerComponent } from './shared/components/wrong-chain-banner/wrong-chain-banner.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    CommonModule,
    ToastComponent,
    NetworkDropdownComponent,
    WalletDropdownComponent,
    SidebarComponent,
    WrongChainBannerComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  public readonly web3Service = inject(Web3Service);

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
}
