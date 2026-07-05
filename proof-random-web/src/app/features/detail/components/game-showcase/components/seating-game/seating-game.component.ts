import { Component, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseGameComponent } from '../base-game.component';
import { Web3Service } from '../../../../../../core/services/web3.service';
import { ToastService } from '../../../../../../core/services/toast.service';
import { inject } from '@angular/core';

@Component({
  selector: 'app-seating-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './seating-game.component.html'
})
export class SeatingGameComponent extends BaseGameComponent implements OnDestroy {
  public readonly web3Service = inject(Web3Service);
  private readonly toastService = inject(ToastService);

  // Signals riêng của game
  public readonly isSeatingRunning = signal<boolean>(false);
  public readonly seatingDone = signal<boolean>(false);
  public readonly seatingLayout = signal<string[][]>([]);
  public readonly seatingCols = signal<number>(4);

  // Timers riêng của game
  

    // ================= 12. SƠ ĐỒ CHỖ NGỒI (SEATING CHART) =================
  public initSeating() {
    this.isSeatingRunning.set(false);
    this.seatingDone.set(false);
    
    const details = this.sessionDetails();
    if (!details) return;
    const cols = parseInt(details.skin.split('-')[1]) || 4;
    this.seatingCols.set(cols);

    if (details.participants) {
      const layout: string[][] = [];
      const participantsList = Array.from(details.participants) as string[];
      for (let i = 0; i < participantsList.length; i += cols) {
        layout.push(participantsList.slice(i, i + cols));
      }
      this.seatingLayout.set(layout);
    } else {
      this.seatingLayout.set([]);
    }
  }

  public startSeating() {
    if (this.isSeatingRunning() || this.seatingDone()) return;
    this.isSeatingRunning.set(true);

    const details = this.sessionDetails();
    if (!details) return;
    
    const cols = this.seatingCols();
    const participantsList = Array.from(details.participants || []) as string[];

    let count = 0;
    const interval = setInterval(() => {
      const mock = [...participantsList].sort(() => Math.random() - 0.5);
      const layout: string[][] = [];
      for (let i = 0; i < mock.length; i += cols) {
        layout.push(mock.slice(i, i + cols));
      }
      this.seatingLayout.set(layout);
      count++;
      
      if (count >= 15) {
        clearInterval(interval);
        
        const res = this.clientResult();
        if (res && res.winners) {
          const layoutReal: string[][] = [];
          const winners = res.winners;
          for (let i = 0; i < winners.length; i += cols) {
            layoutReal.push(winners.slice(i, i + cols));
          }
          this.seatingLayout.set(layoutReal);
        }
        
        this.isSeatingRunning.set(false);
        this.seatingDone.set(true);
        this.toastService.showToast('Xếp sơ đồ chỗ ngồi hoàn tất!', 'success');
      }
    }, 150);
  }

  public skipSeating() {
    this.isSeatingRunning.set(false);
    this.seatingDone.set(true);
    
    const details = this.sessionDetails();
    const res = this.clientResult();
    if (details && res && res.winners) {
      const cols = this.seatingCols();
      const layoutReal: string[][] = [];
      const winners = res.winners;
      for (let i = 0; i < winners.length; i += cols) {
        layoutReal.push(winners.slice(i, i + cols));
      }
      this.seatingLayout.set(layoutReal);
    }
  }


  ngOnDestroy() {

  }
}
