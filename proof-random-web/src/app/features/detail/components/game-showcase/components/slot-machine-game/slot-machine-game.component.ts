import { Component, signal, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseGameComponent } from '../base-game.component';
import { Web3Service } from '../../../../../../core/services/web3.service';
import { ToastService } from '../../../../../../core/services/toast.service';
import { inject } from '@angular/core';

@Component({
  selector: 'app-slot-machine-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './slot-machine-game.component.html'
})
export class SlotMachineGameComponent extends BaseGameComponent implements OnDestroy {
  constructor() {
    super();
    effect(() => {
      const details = this.sessionDetails();
      const res = this.clientResult();
      if (details && res) {
        this.isSlotSpinning.set(false);
        this.slotDone.set(false);
        this.initSlotMachine();
      }
    });
  }
  public readonly web3Service = inject(Web3Service);
  private readonly toastService = inject(ToastService);

  // Signals riêng của game
  public readonly isSlotSpinning = signal<boolean>(false);
  public readonly slotDone = signal<boolean>(false);
  public readonly slotReels = signal<string[][]>([[], [], []]);
  public readonly slotCurrentIndices = signal<number[]>([0, 0, 0]);

  // Timers riêng của game
    private slotIntervalId: any = null;
  private slotTimeoutId: any = null;

    // ================= 8. SLOT MACHINE MAY MẮN =================
  public initSlotMachine() {
    const details = this.sessionDetails();
    if (!details || !details.participants) return;
    const winnerIdx = Number(details.result);
    const winnerName = details.participants[winnerIdx] || 'Winner';
    
    const reels: string[][] = [[], [], []];
    for (let r = 0; r < 3; r++) {
      const shuffled = [...details.participants].sort(() => Math.random() - 0.5);
      reels[r] = [...shuffled, winnerName];
    }
    this.slotReels.set(reels);
    this.slotCurrentIndices.set([0, 0, 0]);
    this.slotDone.set(false);
    this.isSlotSpinning.set(false);
  }

  public startSlot() {
    if (this.isSlotSpinning() || this.slotDone()) return;
    this.isSlotSpinning.set(true);

    const reels = this.slotReels();
    let speed1 = true;
    let speed2 = true;
    let speed3 = true;

    this.slotIntervalId = setInterval(() => {
      this.slotCurrentIndices.update(curr => {
        const next = [...curr];
        if (speed1) next[0] = (next[0] + 1) % reels[0].length;
        if (speed2) next[1] = (next[1] + 1) % reels[1].length;
        if (speed3) next[2] = (next[2] + 1) % reels[2].length;
        return next;
      });
    }, 85);

    this.slotTimeoutId = setTimeout(() => {
      speed1 = false;
      this.slotCurrentIndices.update(curr => [reels[0].length - 1, curr[1], curr[2]]);
      
      this.slotTimeoutId = setTimeout(() => {
        speed2 = false;
        this.slotCurrentIndices.update(curr => [curr[0], reels[1].length - 1, curr[2]]);
        
        this.slotTimeoutId = setTimeout(() => {
          speed3 = false;
          this.slotCurrentIndices.update(curr => [curr[0], curr[1], reels[2].length - 1]);
          clearInterval(this.slotIntervalId);
          this.slotIntervalId = null;
          this.isSlotSpinning.set(false);
          this.slotDone.set(true);
          this.toastService.showToast(`Chúc mừng ${this.clientResult().winners[0]} đã trúng Jackpot Slot!`, 'success');
        }, 1000);
      }, 800);
    }, 1800);
  }

  public skipSlot() {
    if (this.slotIntervalId) {
      clearInterval(this.slotIntervalId);
      this.slotIntervalId = null;
    }
    if (this.slotTimeoutId) {
      clearTimeout(this.slotTimeoutId);
      this.slotTimeoutId = null;
    }
    
    this.isSlotSpinning.set(false);
    this.slotDone.set(true);
    
    const details = this.sessionDetails();
    if (details) {
      const winnerName = details.participants[Number(details.result)] || 'Winner';
      this.slotReels.set([[winnerName], [winnerName], [winnerName]]);
      this.slotCurrentIndices.set([0, 0, 0]);
    }
    this.toastService.showToast(`Chúc mừng ${this.clientResult().winners[0]} đã trúng Jackpot Slot!`, 'success');
  }


  ngOnDestroy() {
    if (this.slotIntervalId) clearInterval(this.slotIntervalId);
    if (this.slotTimeoutId) clearTimeout(this.slotTimeoutId);
  }
}
