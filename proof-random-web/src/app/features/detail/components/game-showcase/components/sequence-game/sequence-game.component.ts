import { Component, signal, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseGameComponent } from '../base-game.component';
import { Web3Service } from '../../../../../../core/services/web3.service';
import { ToastService } from '../../../../../../core/services/toast.service';
import { inject } from '@angular/core';

@Component({
  selector: 'app-sequence-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sequence-game.component.html'
})
export class SequenceGameComponent extends BaseGameComponent implements OnDestroy {
  constructor() {
    super();
    effect(() => {
      const details = this.sessionDetails();
      const res = this.clientResult();
      if (details && res) {
        this.isSequenceRunning.set(false);
        this.sequenceDone.set(false);
        this.initSequence();
      }
    });
  }
  public readonly web3Service = inject(Web3Service);
  private readonly toastService = inject(ToastService);

  // Signals riêng của game
  public readonly isSequenceRunning = signal<boolean>(false);
  public readonly sequenceDone = signal<boolean>(false);
  public readonly shuffledQueue = signal<string[]>([]);

  // Timers riêng của game
  

    // ================= 11. THỨ TỰ NGẪU NHIÊN (SEQUENCE) =================
  public initSequence() {
    this.isSequenceRunning.set(false);
    this.sequenceDone.set(false);
    const details = this.sessionDetails();
    if (details && details.participants) {
      this.shuffledQueue.set(Array.from(details.participants));
    } else {
      this.shuffledQueue.set([]);
    }
  }

  public startSequence() {
    if (this.isSequenceRunning() || this.sequenceDone()) return;
    this.isSequenceRunning.set(true);

    const details = this.sessionDetails();
    if (!details) return;

    let count = 0;
    const participantsList = Array.from(details.participants || []) as string[];
    const interval = setInterval(() => {
      const mock = [...participantsList].sort(() => Math.random() - 0.5);
      this.shuffledQueue.set(mock);
      count++;
      if (count >= 15) {
        clearInterval(interval);
        
        const res = this.clientResult();
        if (res && res.winners) {
          this.shuffledQueue.set(res.winners);
        }
        this.isSequenceRunning.set(false);
        this.sequenceDone.set(true);
        this.toastService.showToast('Xếp thứ tự ngẫu nhiên hoàn tất!', 'success');
      }
    }, 150);
  }

  public skipSequence() {
    this.isSequenceRunning.set(false);
    this.sequenceDone.set(true);
    const res = this.clientResult();
    if (res && res.winners) {
      this.shuffledQueue.set(res.winners);
    }
  }


  ngOnDestroy() {

  }
}
