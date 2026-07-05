import { Component, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseGameComponent } from '../base-game.component';
import { Web3Service } from '../../../../../../core/services/web3.service';
import { ToastService } from '../../../../../../core/services/toast.service';
import { inject } from '@angular/core';

@Component({
  selector: 'app-bau-cua-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './bau-cua-game.component.html'
})
export class BauCuaGameComponent extends BaseGameComponent implements OnDestroy {
  public readonly web3Service = inject(Web3Service);
  private readonly toastService = inject(ToastService);

  // Signals riêng của game
  

  // Timers riêng của game
    private bauCuaTimeoutId: any = null;

    // 4. Bầu Cua Tôm Cá (Bau Cua)
  public readonly isBauCuaShaking = signal<boolean>(false);
  public readonly bauCuaOpened = signal<boolean>(false);
  public bauCuaResultDice: number[] = [0, 0, 0];
  public readonly bauCuaItems = [
    { icon: '', name: 'Bầu' },
    { icon: '', name: 'Cua' },
    { icon: '', name: 'Tôm' },
    { icon: '', name: 'Cá' },
    { icon: '', name: 'Gà' },
    { icon: '', name: 'Nai' }
  ];

  public shakeBauCua() {
    if (this.isBauCuaShaking() || this.bauCuaOpened()) return;
    this.isBauCuaShaking.set(true);
    
    const details = this.sessionDetails();
    if (!details || !details.randomWord) return;
    
    const seed = BigInt(details.randomWord);
    const d1 = Number(seed % 6n);
    const hash2 = this.web3Service.solidityKeccak256(['uint256', 'uint256'], [seed.toString(), '1']);
    const d2 = Number(BigInt(hash2) % 6n);
    const hash3 = this.web3Service.solidityKeccak256(['uint256', 'uint256'], [seed.toString(), '2']);
    const d3 = Number(BigInt(hash3) % 6n);
    
    this.bauCuaResultDice = [d1, d2, d3];
    
    this.bauCuaTimeoutId = setTimeout(() => {
      this.isBauCuaShaking.set(false);
      this.bauCuaOpened.set(true);
      const winnersText = this.bauCuaResultDice.map(i => this.bauCuaItems[i].name).join(' - ');
      this.toastService.showToast(`Kết quả Bầu Cua: ${winnersText}`, 'success');
    }, 2000);
  }

  public skipBauCua() {
    if (this.bauCuaTimeoutId) {
      clearTimeout(this.bauCuaTimeoutId);
      this.bauCuaTimeoutId = null;
    }
    
    const details = this.sessionDetails();
    if (!details || !details.randomWord) return;
    
    const seed = BigInt(details.randomWord);
    const d1 = Number(seed % 6n);
    const hash2 = this.web3Service.solidityKeccak256(['uint256', 'uint256'], [seed.toString(), '1']);
    const d2 = Number(BigInt(hash2) % 6n);
    const hash3 = this.web3Service.solidityKeccak256(['uint256', 'uint256'], [seed.toString(), '2']);
    const d3 = Number(BigInt(hash3) % 6n);
    
    this.bauCuaResultDice = [d1, d2, d3];
    this.isBauCuaShaking.set(false);
    this.bauCuaOpened.set(true);
    const winnersText = this.bauCuaResultDice.map(i => this.bauCuaItems[i].name).join(' - ');
    this.toastService.showToast(`Kết quả Bầu Cua: ${winnersText}`, 'success');
  }


  ngOnDestroy() {
    if (this.bauCuaTimeoutId) clearTimeout(this.bauCuaTimeoutId);
  }
}
