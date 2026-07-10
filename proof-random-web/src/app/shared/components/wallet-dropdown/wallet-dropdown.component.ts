import { Component, inject, signal, HostListener, ElementRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Web3Service } from '../../../core/services/web3.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-wallet-dropdown',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './wallet-dropdown.component.html'
})
export class WalletDropdownComponent {
  @Input() isMobile = false;

  public readonly web3Service = inject(Web3Service);
  private readonly toastService = inject(ToastService);
  private readonly elementRef = inject(ElementRef);

  public readonly isWalletDropdownOpen = signal<boolean>(false);

  public connectWallet() {
    this.web3Service.connectWallet();
  }

  public disconnectWallet() {
    this.web3Service.disconnectWallet();
    this.isWalletDropdownOpen.set(false);
  }

  public copyWalletAddress() {
    const addr = this.web3Service.currentAccount();
    if (addr) {
      navigator.clipboard.writeText(addr);
      this.toastService.showToast('Đã sao chép địa chỉ ví!', 'success');
    }
    this.isWalletDropdownOpen.set(false);
  }

  public openWalletModal(event: Event) {
    event.stopPropagation();
    this.isWalletDropdownOpen.set(false);
    setTimeout(() => {
      this.web3Service.openWalletModal();
    }, 100);
  }

  @HostListener('document:click', ['$event'])
  public onClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const containerId = this.isMobile ? '#mobile-wallet-dropdown-container' : '#wallet-dropdown-container';
    const isInside = this.elementRef.nativeElement.querySelector(containerId)?.contains(target);
    if (!isInside) {
      this.isWalletDropdownOpen.set(false);
    }
  }
}
