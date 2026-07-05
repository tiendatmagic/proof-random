import { Component, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseGameComponent } from '../base-game.component';
import { Web3Service } from '../../../../../../core/services/web3.service';
import { ToastService } from '../../../../../../core/services/toast.service';
import { inject } from '@angular/core';

@Component({
  selector: 'app-racing-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './racing-game.component.html'
})
export class RacingGameComponent extends BaseGameComponent implements OnDestroy {
  public readonly web3Service = inject(Web3Service);
  private readonly toastService = inject(ToastService);

  // Signals riêng của game
  public readonly isRacing = signal<boolean>(false);
  public readonly raceDone = signal<boolean>(false);
  public readonly racerProgresses = signal<number[]>([]);

  // Timers riêng của game
    private raceAnimationFrameId: any = null;

    private initRacingProgress() {
    const details = this.sessionDetails();
    if (details && details.participants && this.skinType === 'Racing') {
      this.racerProgresses.set(new Array(details.participants.length).fill(0));
    }
  }
  
  public startRace() {
    if (this.isRacing() || this.raceDone()) return;
    this.isRacing.set(true);
    
    const details = this.sessionDetails();
    if (!details || !details.participants) return;
    
    const count = details.participants.length;
    this.racerProgresses.set(new Array(count).fill(0));
    const winnerIdx = Number(details.result);
    
    const duration = 5000;
    let startTimestamp: number | null = null;
    
    const animate = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);
      
      const current = new Array(count);
      for (let i = 0; i < count; i++) {
        if (i === winnerIdx) {
          current[i] = progress * 100;
        } else {
          // Các xe khác chạy loạng choạng và kẹt ở tối đa 88%
          const wave = Math.sin(progress * Math.PI * 2 + i) * 6;
          current[i] = Math.min(progress * 80 + wave, 88);
        }
      }
      this.racerProgresses.set(current);
      
      if (progress < 1) {
        this.raceAnimationFrameId = requestAnimationFrame(animate);
      } else {
        this.isRacing.set(false);
        this.raceDone.set(true);
        this.toastService.showToast(`Chúc mừng ${this.clientResult().winners[0]} đã về đích đầu tiên!`, 'success');
      }
    };
    this.raceAnimationFrameId = requestAnimationFrame(animate);
  }


  

  public skipRace() {
    this.isRacing.set(false);
    this.raceDone.set(true);
    if (this.raceAnimationFrameId) cancelAnimationFrame(this.raceAnimationFrameId);
    
    const details = this.sessionDetails();
    if (details && details.participants && details.result !== undefined && details.result !== null) {
      const count = details.participants.length;
      const winnerIdx = Number(details.result);
      const current = new Array(count).fill(50);
      current[winnerIdx] = 100;
      this.racerProgresses.set(current);
    }
  }

  ngOnDestroy() {
    if (this.raceAnimationFrameId) clearTimeout(this.raceAnimationFrameId);
  }
}
