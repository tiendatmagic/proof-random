import { Component, signal, OnDestroy, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseGameComponent } from '../base-game.component';
import { ToastService } from '../../../../../../core/services/toast.service';

@Component({
  selector: 'app-standard-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './standard-game.component.html'
})
export class StandardGameComponent extends BaseGameComponent implements OnDestroy {
  private readonly toastService = inject(ToastService);

  // 1. Signals cho Coin Flip (Lật đồng xu)
  public readonly isCoinRunning = signal<boolean>(false);
  public readonly coinDone = signal<boolean>(false);
  public readonly tempCoinFace = signal<string>('Heads');

  // 2. Signals cho Dice (Xúc xắc)
  public readonly isDiceRunning = signal<boolean>(false);
  public readonly diceDone = signal<boolean>(false);
  public readonly tempDiceValues = signal<string[]>([]);

  // Timers để dọn dẹp
  private coinIntervalId: any = null;
  private coinTimeoutId: any = null;
  private diceIntervalId: any = null;
  private diceTimeoutId: any = null;

  constructor() {
    super();

    // Tự động reset trạng thái hoạt ảnh khi nhận dữ liệu phiên mới
    effect(() => {
      const details = this.sessionDetails();
      const res = this.clientResult();
      if (details && res) {
        this.resetAnimationStates();
      }
    });
  }

  /**
   * Reset toàn bộ các timer và trạng thái hiển thị
   */
  private resetAnimationStates() {
    // Coin flip clean up
    if (this.coinIntervalId) clearInterval(this.coinIntervalId);
    if (this.coinTimeoutId) clearTimeout(this.coinTimeoutId);
    this.isCoinRunning.set(false);
    this.coinDone.set(false);
    this.tempCoinFace.set('Heads');

    // Dice clean up
    if (this.diceIntervalId) clearInterval(this.diceIntervalId);
    if (this.diceTimeoutId) clearTimeout(this.diceTimeoutId);
    this.isDiceRunning.set(false);
    this.diceDone.set(false);
    this.tempDiceValues.set([]);
  }

  // ================= COIN FLIP ANIMATION =================
  public startCoinFlip() {
    if (this.isCoinRunning() || this.coinDone()) return;
    this.isCoinRunning.set(true);

    const res = this.clientResult();
    if (!res || !res.result) return;
    const finalFace = res.result; // 'Heads' hoặc 'Tails'

    // Nhấp nháy đổi mặt đồng xu liên tục
    this.coinIntervalId = setInterval(() => {
      this.tempCoinFace.update(face => face === 'Heads' ? 'Tails' : 'Heads');
    }, 100);

    // Dừng lại sau 3 giây và chốt kết quả
    this.coinTimeoutId = setTimeout(() => {
      if (this.coinIntervalId) clearInterval(this.coinIntervalId);
      this.isCoinRunning.set(false);
      this.coinDone.set(true);
      this.tempCoinFace.set(finalFace);
      this.toastService.showToast(`Đồng xu đã dừng! Kết quả là: ${finalFace === 'Heads' ? 'Mặt Chân dung (Heads)' : 'Mặt Số (Tails)'}!`, 'success');
    }, 3000);
  }

  public skipCoinFlip() {
    if (this.coinIntervalId) clearInterval(this.coinIntervalId);
    if (this.coinTimeoutId) clearTimeout(this.coinTimeoutId);
    this.isCoinRunning.set(false);
    this.coinDone.set(true);

    const res = this.clientResult();
    if (res && res.result) {
      this.tempCoinFace.set(res.result);
    }
  }

  // ================= DICE ROLL ANIMATION =================
  private extractDiceValues(details: any, res: any): string[] {
    const finalWinners: string[] = res.winners || [];
    if (finalWinners.length > 0) {
      // Nhiều xúc xắc (drawType 3 + Dice skin): winners là danh sách mặt xúc xắc
      return finalWinners.map((w: string) => {
        const clean = w.replace(/[^\d]/g, '');
        return clean || '1';
      });
    }
    // 1 xúc xắc (drawType 5): result là giá trị số mặt trực tiếp
    const single = String(res.result || '1').replace(/[^\d]/g, '');
    return [single || '1'];
  }

  public startDiceRoll() {
    if (this.isDiceRunning() || this.diceDone()) return;
    this.isDiceRunning.set(true);

    const details = this.sessionDetails();
    const res = this.clientResult();
    if (!details || !res) return;

    // Số mặt xúc xắc (mặc định 6)
    const sides = Number(details.param1) || 6;
    // Số lượng quân xúc xắc: drawType 3 dùng param2, drawType 5 là 1
    const diceCount = (details.drawType === 3) ? (Number(details.param2) || 1) : 1;

    // Nhấp nháy các trị số ngẫu nhiên trên các xúc xắc
    this.diceIntervalId = setInterval(() => {
      const randValues = Array.from({ length: diceCount }, () =>
        (Math.floor(Math.random() * sides) + 1).toString()
      );
      this.tempDiceValues.set(randValues);
    }, 100);

    // Dừng lại sau 3 giây và chốt kết quả
    this.diceTimeoutId = setTimeout(() => {
      if (this.diceIntervalId) clearInterval(this.diceIntervalId);
      this.isDiceRunning.set(false);
      this.diceDone.set(true);

      const finalValues = this.extractDiceValues(details, res);
      this.tempDiceValues.set(finalValues);

      if (finalValues.length === 1) {
        this.toastService.showToast(`Xúc xắc đã dừng! Kết quả: Mặt số ${finalValues[0]}!`, 'success');
      } else {
        this.toastService.showToast(`Xúc xắc đã dừng! Kết quả: ${finalValues.join(' - ')}!`, 'success');
      }
    }, 3000);
  }

  public skipDiceRoll() {
    if (this.diceIntervalId) clearInterval(this.diceIntervalId);
    if (this.diceTimeoutId) clearTimeout(this.diceTimeoutId);
    this.isDiceRunning.set(false);
    this.diceDone.set(true);

    const details = this.sessionDetails();
    const res = this.clientResult();
    if (details && res) {
      const finalValues = this.extractDiceValues(details, res);
      this.tempDiceValues.set(finalValues);
    }
  }

  ngOnDestroy() {
    if (this.coinIntervalId) clearInterval(this.coinIntervalId);
    if (this.coinTimeoutId) clearTimeout(this.coinTimeoutId);
    if (this.diceIntervalId) clearInterval(this.diceIntervalId);
    if (this.diceTimeoutId) clearTimeout(this.diceTimeoutId);
  }
}
