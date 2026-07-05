import { Component, signal, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseGameComponent } from '../base-game.component';
import { Web3Service } from '../../../../../../core/services/web3.service';
import { ToastService } from '../../../../../../core/services/toast.service';
import { inject } from '@angular/core';

@Component({
  selector: 'app-card-draw-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './card-draw-game.component.html'
})
export class CardDrawGameComponent extends BaseGameComponent implements OnDestroy {
  constructor() {
    super();
    effect(() => {
      const details = this.sessionDetails();
      const res = this.clientResult();
      if (details && res) {
        this.isCardShuffling.set(false);
        this.cardDone.set(false);
        this.initCardDraw();
      }
    });
  }
  public readonly web3Service = inject(Web3Service);
  private readonly toastService = inject(ToastService);

  // Signals riêng của game
  public readonly isCardShuffling = signal<boolean>(false);
  public readonly cardDone = signal<boolean>(false);
  public readonly cards = signal<any[]>([]);
  public readonly pickedCardIdx = signal<number | null>(null);

  // Timers riêng của game
  

    // ================= 9. BỐC BÀI TÂY (CARD DRAW) =================
  public initCardDraw() {
    const details = this.sessionDetails();
    if (!details || !details.participants) return;
    const participantsList = Array.from(details.participants || []) as string[];
    const winnerIdx = Number(details.result);
    const winnerName = participantsList[winnerIdx] || 'Winner';

    const cardsList = [{ name: winnerName, isWinner: true, flipped: false }];
    const others = participantsList
      .filter((p: string, idx: number) => idx !== winnerIdx)
      .sort(() => Math.random() - 0.5)
      .slice(0, 4);

    others.forEach((p: string) => {
      cardsList.push({ name: p, isWinner: false, flipped: false });
    });

    const shuffled = cardsList.sort(() => Math.random() - 0.5);
    this.cards.set(shuffled);
    this.cardDone.set(false);
    this.pickedCardIdx.set(null);
    this.isCardShuffling.set(false);
  }

  public shuffleCards() {
    if (this.isCardShuffling() || this.cardDone()) return;
    this.isCardShuffling.set(true);
    
    setTimeout(() => {
      this.isCardShuffling.set(false);
      this.toastService.showToast('Xáo bài hoàn tất! Vui lòng chọn 1 lá bài tây.', 'success');
    }, 1500);
  }

  public pickCard(idx: number) {
    if (this.isCardShuffling() || this.cardDone() || this.pickedCardIdx() !== null) return;
    
    this.pickedCardIdx.set(idx);
    
    // Lật thẻ được bốc
    this.cards.update(list => {
      const next = [...list];
      next[idx].flipped = true;
      return next;
    });

    // Lật nốt các thẻ khác sau 1s
    setTimeout(() => {
      this.cards.update(list => {
        return list.map(c => ({ ...c, flipped: true }));
      });
      this.cardDone.set(true);
      const isWinner = this.cards()[idx].isWinner;
      if (isWinner) {
        this.toastService.showToast(`Tuyệt vời! Bạn đã chọn trúng lá bài chiến thắng: ${this.cards()[idx].name}`, 'success');
      } else {
        this.toastService.showToast(`Người chiến thắng thực sự là: ${this.clientResult().winners[0]}`, 'success');
      }
    }, 1000);
  }

  public skipCard() {
    this.isCardShuffling.set(false);
    this.cardDone.set(true);
    this.pickedCardIdx.set(0);
    this.cards.update(list => {
      return list.map(c => ({ ...c, flipped: true }));
    });
    this.toastService.showToast(`Người chiến thắng: ${this.clientResult().winners[0]}`, 'success');
  }


  ngOnDestroy() {

  }
}
