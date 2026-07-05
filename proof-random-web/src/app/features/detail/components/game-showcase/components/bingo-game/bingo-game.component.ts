import { Component, signal, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseGameComponent } from '../base-game.component';
import { Web3Service } from '../../../../../../core/services/web3.service';
import { ToastService } from '../../../../../../core/services/toast.service';
import { inject } from '@angular/core';

@Component({
  selector: 'app-bingo-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './bingo-game.component.html'
})
export class BingoGameComponent extends BaseGameComponent implements OnDestroy {
  constructor() {
    super();
    effect(() => {
      const details = this.sessionDetails();
      const res = this.clientResult();
      if (details && res) {
        this.isBingoRunning.set(false);
        this.bingoDone.set(false);
        this.initBingo();
      }
    });
  }
  public readonly web3Service = inject(Web3Service);
  private readonly toastService = inject(ToastService);

  // Signals riêng của game
  public readonly isBingoRunning = signal<boolean>(false);
  public readonly bingoDone = signal<boolean>(false);
  public readonly bingoNumber = signal<number | null>(null);
  public readonly bingoNumbers = signal<number[]>([]);
  public readonly bingoBallList = signal<number[]>([]);

  // Timers riêng của game
    private bingoTimeoutId: any = null;
  private bingoIntervalId: any = null;

    // ================= 15. QUAY SỐ BINGO (BINGO) =================
  private bingoBallIntervalId: any = null;

  public getBingoResults(): number[] {
    const details = this.sessionDetails();
    if (!details || !details.result) return [];
    if (details.drawType === 3) {
      return details.result.split(',').map((x: string) => Number(x) + 1);
    }
    return [Number(details.result)];
  }

  public initBingo() {
    this.isBingoRunning.set(false);
    this.bingoDone.set(false);
    this.bingoNumber.set(null);
    this.bingoNumbers.set([]);
    if (this.bingoBallIntervalId) clearInterval(this.bingoBallIntervalId);
    if (this.bingoTimeoutId) clearTimeout(this.bingoTimeoutId);
    this.bingoBallList.set([12, 25, 47, 88, 9, 36, 73, 52, 61, 80]);
  }

  public startBingo() {
    if (this.isBingoRunning() || this.bingoDone()) return;
    this.isBingoRunning.set(true);

    const details = this.sessionDetails();
    if (!details || !details.result) return;
    const results = this.getBingoResults();

    this.bingoBallIntervalId = setInterval(() => {
      const randomBalls = Array.from({ length: 10 }, () => Math.floor(Math.random() * 90) + 1);
      this.bingoBallList.set(randomBalls);
    }, 100);

    this.bingoTimeoutId = setTimeout(() => {
      if (this.bingoBallIntervalId) clearInterval(this.bingoBallIntervalId);
      this.isBingoRunning.set(false);
      this.bingoDone.set(true);
      this.bingoNumbers.set(results);
      if (results.length > 0) {
        this.bingoNumber.set(results[results.length - 1]);
      }
      if (results.length === 1) {
        this.toastService.showToast(`Bingo! Con số may mắn là: ${results[0]}!`, 'success');
      } else {
        this.toastService.showToast(`Bingo! Đã quay ra ${results.length} con số may mắn!`, 'success');
      }
    }, 3000);
  }

  public skipBingo() {
    if (this.bingoBallIntervalId) clearInterval(this.bingoBallIntervalId);
    if (this.bingoTimeoutId) clearTimeout(this.bingoTimeoutId);
    this.isBingoRunning.set(false);
    this.bingoDone.set(true);

    const results = this.getBingoResults();
    this.bingoNumbers.set(results);
    if (results.length > 0) {
      this.bingoNumber.set(results[results.length - 1]);
    }
  }

  ngOnDestroy() {
    if (this.bingoBallIntervalId) clearInterval(this.bingoBallIntervalId);
    if (this.bingoTimeoutId) clearTimeout(this.bingoTimeoutId);
    if (this.bingoIntervalId) clearInterval(this.bingoIntervalId);
  }
}
