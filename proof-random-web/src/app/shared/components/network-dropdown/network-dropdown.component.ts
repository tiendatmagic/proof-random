import { Component, inject, signal, HostListener, ElementRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Web3Service } from '../../../core/services/web3.service';

@Component({
  selector: 'app-network-dropdown',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './network-dropdown.component.html'
})
export class NetworkDropdownComponent {
  @Input() isMobile = false;

  public readonly web3Service = inject(Web3Service);
  private readonly elementRef = inject(ElementRef);

  public readonly isChainDropdownOpen = signal<boolean>(false);

  public switchNetwork(chainId: string) {
    this.web3Service.switchNetwork(chainId);
    this.isChainDropdownOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  public onClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const containerId = this.isMobile ? '#mobile-chain-dropdown-container' : '#chain-dropdown-container';
    const isInside = this.elementRef.nativeElement.querySelector(containerId)?.contains(target);
    if (!isInside) {
      this.isChainDropdownOpen.set(false);
    }
  }
}
