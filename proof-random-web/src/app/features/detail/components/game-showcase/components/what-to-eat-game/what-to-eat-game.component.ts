import { Component, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseGameComponent } from '../base-game.component';
import { Web3Service } from '../../../../../../core/services/web3.service';
import { ToastService } from '../../../../../../core/services/toast.service';
import { inject } from '@angular/core';

@Component({
  selector: 'app-what-to-eat-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './what-to-eat-game.component.html'
})
export class WhatToEatGameComponent extends BaseGameComponent implements OnDestroy {
  public readonly web3Service = inject(Web3Service);
  private readonly toastService = inject(ToastService);

  // Signals riêng của game
  public readonly isFoodOpening = signal<boolean>(false);
  public readonly foodOpened = signal<boolean>(false);

  // Timers riêng của game
  

    // ================= 13. HÔM NAY ĂN GÌ? (WHAT TO EAT) =================
  private eatTimeoutId: any = null;

  public initWhatToEat() {
    this.isFoodOpening.set(false);
    this.foodOpened.set(false);
    if (this.eatTimeoutId) clearTimeout(this.eatTimeoutId);
  }

  public startWhatToEat() {
    if (this.isFoodOpening() || this.foodOpened()) return;
    this.isFoodOpening.set(true);

    this.eatTimeoutId = setTimeout(() => {
      this.isFoodOpening.set(false);
      this.foodOpened.set(true);
      
      const winners = this.clientResult()?.winners || [];
      if (winners.length === 1) {
        this.toastService.showToast(`Món ngon của bạn hôm nay: ${winners[0]}!`, 'success');
      } else if (winners.length > 1) {
        this.toastService.showToast(`Đã chọn ra ${winners.length} món ngon cho thực đơn hôm nay!`, 'success');
      } else {
        this.toastService.showToast(`Đã mở nắp khay thức ăn!`, 'success');
      }
    }, 2500);
  }

  public skipWhatToEat() {
    if (this.eatTimeoutId) clearTimeout(this.eatTimeoutId);
    this.isFoodOpening.set(false);
    this.foodOpened.set(true);
    
    const winners = this.clientResult()?.winners || [];
    if (winners.length === 1) {
      this.toastService.showToast(`Món ngon của bạn hôm nay: ${winners[0]}!`, 'success');
    } else if (winners.length > 1) {
      this.toastService.showToast(`Đã chọn ra ${winners.length} món ngon cho thực đơn hôm nay!`, 'success');
    } else {
      this.toastService.showToast(`Đã mở nắp khay thức ăn!`, 'success');
    }
  }


  ngOnDestroy() {
    if (this.eatTimeoutId) clearTimeout(this.eatTimeoutId);
  }
}
