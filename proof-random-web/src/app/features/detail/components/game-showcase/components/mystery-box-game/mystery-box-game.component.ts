import { Component, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseGameComponent } from '../base-game.component';
import { Web3Service } from '../../../../../../core/services/web3.service';
import { ToastService } from '../../../../../../core/services/toast.service';
import { inject } from '@angular/core';

@Component({
  selector: 'app-mystery-box-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mystery-box-game.component.html'
})
export class MysteryBoxGameComponent extends BaseGameComponent implements OnDestroy {
  public readonly web3Service = inject(Web3Service);
  private readonly toastService = inject(ToastService);

  // Signals riêng của game
  

  // Timers riêng của game
    private boxTimeoutId: any = null;

    // 3. Hộp quà bí ẩn (Mystery Box)
  public readonly isBoxOpening = signal<boolean>(false);
  public readonly boxOpened = signal<boolean>(false);
  
  public openBox() {
    if (this.isBoxOpening() || this.boxOpened()) return;
    this.isBoxOpening.set(true);
    
    this.boxTimeoutId = setTimeout(() => {
      this.isBoxOpening.set(false);
      this.boxOpened.set(true);
      this.toastService.showToast(`Hộp quà đã mở! Chúc mừng: ${this.clientResult().winners[0]}`, 'success');
    }, 2000);
  }


  

  public skipBox() {
    this.isBoxOpening.set(false);
    this.boxOpened.set(true);
  }

  ngOnDestroy() {
    if (this.boxTimeoutId) clearTimeout(this.boxTimeoutId);
  }
}
