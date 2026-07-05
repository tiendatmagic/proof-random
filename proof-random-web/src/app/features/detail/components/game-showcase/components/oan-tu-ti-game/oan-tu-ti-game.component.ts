import { Component, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseGameComponent } from '../base-game.component';
import { Web3Service } from '../../../../../../core/services/web3.service';
import { ToastService } from '../../../../../../core/services/toast.service';
import { inject } from '@angular/core';

@Component({
  selector: 'app-oan-tu-ti-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './oan-tu-ti-game.component.html'
})
export class OanTuTiGameComponent extends BaseGameComponent implements OnDestroy {
  public readonly web3Service = inject(Web3Service);
  private readonly toastService = inject(ToastService);

  // Signals riêng của game
  public readonly isOanTuTiRunning = signal<boolean>(false);
  public readonly oanTuTiDone = signal<boolean>(false);
  public readonly playerHand = signal<string>('rock');
  public readonly cpuHand = signal<string>('rock');
  public readonly oanTuTiResultText = signal<string>('');

  // Timers riêng của game
    private oanTuTiTimeoutId: any = null;

    // ================= 10. OẢN TÙ TÌ (OANTUTI) =================
  public resetOanTuTi() {
    this.playerHand.set('rock');
    this.cpuHand.set('rock');
    this.oanTuTiResultText.set('');
    this.oanTuTiDone.set(false);
    this.isOanTuTiRunning.set(false);
  }

  public startOanTuTi() {
    if (this.isOanTuTiRunning() || this.oanTuTiDone()) return;
    this.isOanTuTiRunning.set(true);

    const details = this.sessionDetails();
    if (!details || !details.randomWord) return;

    // Trong lúc lắc tay (2 giây), cả hai bên giữ hình nắm đấm (rock)
    this.playerHand.set('rock');
    this.cpuHand.set('rock');

    this.oanTuTiTimeoutId = setTimeout(() => {
      const seedVal = BigInt(details.randomWord);
      const playerMod = Number(seedVal % 3n);
      const cpuMod = Number((seedVal / 3n) % 3n);
      const handsValue = ['scissors', 'rock', 'paper']; // 0 = Kéo, 1 = Búa, 2 = Bao
      const handsVN = ['Kéo', 'Búa', 'Bao'];
      
      const pHand = handsValue[playerMod];
      const cHand = handsValue[cpuMod];

      this.playerHand.set(pHand);
      this.cpuHand.set(cHand);
      
      this.isOanTuTiRunning.set(false);
      this.oanTuTiDone.set(true);
      
      const winnerName = this.clientResult()?.winners[0] || 'Người chơi';
      let winnerText = '';
      let toastMsg = '';
      if (playerMod === cpuMod) {
        winnerText = `Người chơi "${winnerName}" (${handsVN[playerMod]}) HÒA Máy (${handsVN[cpuMod]})`;
        toastMsg = `Oản tù tì kết thúc! Kết quả HÒA!`;
      } else if ((playerMod === 0 && cpuMod === 2) || (playerMod === 1 && cpuMod === 0) || (playerMod === 2 && cpuMod === 1)) {
        winnerText = `Người chơi "${winnerName}" (${handsVN[playerMod]}) CHIẾN THẮNG Máy (${handsVN[cpuMod]})`;
        toastMsg = `Oản tù tì kết thúc! Người chơi ${winnerName} chiến thắng!`;
      } else {
        winnerText = `Máy (${handsVN[cpuMod]}) CHIẾN THẮNG Người chơi "${winnerName}" (${handsVN[playerMod]})`;
        toastMsg = `Oản tù tì kết thúc! Máy chiến thắng!`;
      }
      this.oanTuTiResultText.set(winnerText);
      this.toastService.showToast(toastMsg, 'success');
    }, 2000);
  }

  public skipOanTuTi() {
    if (this.oanTuTiTimeoutId) clearTimeout(this.oanTuTiTimeoutId);
    this.isOanTuTiRunning.set(false);
    this.oanTuTiDone.set(true);

    const details = this.sessionDetails();
    if (details) {
      const seedVal = BigInt(details.randomWord);
      const playerMod = Number(seedVal % 3n);
      const cpuMod = Number((seedVal / 3n) % 3n);
      const hands = ['scissors', 'rock', 'paper'];
      const handsVN = ['Kéo', 'Búa', 'Bao'];
      this.playerHand.set(hands[playerMod]);
      this.cpuHand.set(hands[cpuMod]);
      
      const winnerName = this.clientResult()?.winners[0] || 'Người chơi';
      let winnerText = '';
      if (playerMod === cpuMod) {
        winnerText = `Người chơi "${winnerName}" (${handsVN[playerMod]}) HÒA Máy (${handsVN[cpuMod]})`;
      } else if ((playerMod === 0 && cpuMod === 2) || (playerMod === 1 && cpuMod === 0) || (playerMod === 2 && cpuMod === 1)) {
        winnerText = `Người chơi "${winnerName}" (${handsVN[playerMod]}) CHIẾN THẮNG Máy (${handsVN[cpuMod]})`;
      } else {
        winnerText = `Máy (${handsVN[cpuMod]}) CHIẾN THẮNG Người chơi "${winnerName}" (${handsVN[playerMod]})`;
      }
      this.oanTuTiResultText.set(winnerText);
    }
  }


  ngOnDestroy() {
    if (this.oanTuTiTimeoutId) clearTimeout(this.oanTuTiTimeoutId);
  }
}
