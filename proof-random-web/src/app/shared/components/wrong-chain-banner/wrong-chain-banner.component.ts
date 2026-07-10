import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Web3Service } from '../../../core/services/web3.service';

@Component({
  selector: 'app-wrong-chain-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './wrong-chain-banner.component.html'
})
export class WrongChainBannerComponent {
  public readonly web3Service = inject(Web3Service);

  public switchNetwork(chainId: string) {
    this.web3Service.switchNetwork(chainId);
  }

  public disconnectWallet() {
    this.web3Service.disconnectWallet();
  }
}
