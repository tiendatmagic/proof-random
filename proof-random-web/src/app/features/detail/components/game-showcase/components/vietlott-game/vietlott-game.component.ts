import { Component, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseGameComponent } from '../base-game.component';
import { Web3Service } from '../../../../../../core/services/web3.service';
import { ToastService } from '../../../../../../core/services/toast.service';
import { inject } from '@angular/core';

@Component({
  selector: 'app-vietlott-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './vietlott-game.component.html'
})
export class VietlottGameComponent extends BaseGameComponent implements OnDestroy {
  public readonly web3Service = inject(Web3Service);
  private readonly toastService = inject(ToastService);

  // Signals riêng của game
  

  // Timers riêng của game
    private vietlottIntervalId: any = null;

    // 6. Xổ số Vietlott (Vietlott Lottery)
  public readonly selectedVietlottType = signal<'Power655' | 'Mega645' | 'Keno'>('Power655');
  public readonly isVietlottDrawing = signal<boolean>(false);
  public readonly vietlottDone = signal<boolean>(false);
  public readonly vietlottNumbers = signal<number[]>([]);
  public readonly vietlottBonus = signal<number | null>(null);
  public readonly revealedCount = signal<number>(0);
  public readonly currentSpinningNumber = signal<number>(0);

  public getVietlottResults(type: string): { numbers: number[], bonus?: number } {
    const details = this.sessionDetails();
    if (!details || !details.randomWord || details.randomWord === '0') {
      return { numbers: [] };
    }
    
    const seed = details.randomWord;
    
    if (type === 'Mega645') {
      const pool = Array.from({ length: 45 }, (_, i) => i + 1);
      const results: number[] = [];
      let currentSeed = seed;
      
      for (let i = 0; i < 6; i++) {
        const hash = this.web3Service.solidityKeccak256(['uint256', 'string'], [currentSeed, `Mega645_${i}`]);
        const randIdx = Number(BigInt(hash) % BigInt(pool.length));
        results.push(pool.splice(randIdx, 1)[0]);
        currentSeed = hash;
      }
      results.sort((a, b) => a - b);
      return { numbers: results };
      
    } else if (type === 'Power655') {
      const pool = Array.from({ length: 55 }, (_, i) => i + 1);
      const results: number[] = [];
      let currentSeed = seed;
      
      for (let i = 0; i < 6; i++) {
        const hash = this.web3Service.solidityKeccak256(['uint256', 'string'], [currentSeed, `Power655_${i}`]);
        const randIdx = Number(BigInt(hash) % BigInt(pool.length));
        results.push(pool.splice(randIdx, 1)[0]);
        currentSeed = hash;
      }
      results.sort((a, b) => a - b);
      
      const bonusHash = this.web3Service.solidityKeccak256(['uint256', 'string'], [currentSeed, 'Power655_Bonus']);
      const bonusIdx = Number(BigInt(bonusHash) % BigInt(pool.length));
      const bonus = pool[bonusIdx];
      
      return { numbers: results, bonus };
      
    } else { // Keno
      const pool = Array.from({ length: 80 }, (_, i) => i + 1);
      const results: number[] = [];
      let currentSeed = seed;
      
      for (let i = 0; i < 20; i++) {
        const hash = this.web3Service.solidityKeccak256(['uint256', 'string'], [currentSeed, `Keno_${i}`]);
        const randIdx = Number(BigInt(hash) % BigInt(pool.length));
        results.push(pool.splice(randIdx, 1)[0]);
        currentSeed = hash;
      }
      results.sort((a, b) => a - b);
      return { numbers: results };
    }
  }

  public selectVietlottType(type: 'Power655' | 'Mega645' | 'Keno') {
    if (this.isVietlottDrawing()) return;
    this.selectedVietlottType.set(type);
    this.resetVietlottState();
  }

  public resetVietlottState() {
    if (this.vietlottIntervalId) {
      clearInterval(this.vietlottIntervalId);
      this.vietlottIntervalId = null;
    }
    this.vietlottNumbers.set([]);
    this.vietlottBonus.set(null);
    this.revealedCount.set(0);
    this.isVietlottDrawing.set(false);
    this.vietlottDone.set(false);
  }

  public startVietlottDraw() {
    if (this.isVietlottDrawing() || this.vietlottDone()) return;
    
    this.resetVietlottState();
    this.isVietlottDrawing.set(true);
    
    const type = this.selectedVietlottType();
    const resultObj = this.getVietlottResults(type);
    
    const totalBalls = type === 'Keno' ? 20 : (type === 'Power655' ? 7 : 6);
    const maxVal = type === 'Keno' ? 80 : (type === 'Power655' ? 55 : 45);
    
    const finalNumbers = resultObj.numbers;
    const bonusVal = resultObj.bonus || null;
    
    let spinTimer = setInterval(() => {
      this.currentSpinningNumber.set(Math.floor(Math.random() * maxVal) + 1);
    }, 50);
    
    this.vietlottIntervalId = setInterval(() => {
      const currentRevealed = this.revealedCount();
      
      if (currentRevealed < totalBalls) {
        let numChot = 0;
        if (type === 'Power655' && currentRevealed === 6) {
          numChot = bonusVal!;
          this.vietlottBonus.set(bonusVal);
        } else {
          numChot = finalNumbers[currentRevealed];
          this.vietlottNumbers.update(arr => [...arr, numChot]);
        }
        
        this.revealedCount.set(currentRevealed + 1);
        
        if (this.revealedCount() === totalBalls) {
          clearInterval(this.vietlottIntervalId);
          clearInterval(spinTimer);
          this.vietlottIntervalId = null;
          this.isVietlottDrawing.set(false);
          this.vietlottDone.set(true);
          
          const textWin = type === 'Keno' 
            ? 'Bảng số Keno đã được chốt!'
            : (type === 'Power655' 
                ? `Chúc mừng bạn đã quay được bộ số Power 6/55: ${finalNumbers.join(', ')} | Số phụ: ${bonusVal}`
                : `Chúc mừng bạn đã quay được bộ số Mega 6/45: ${finalNumbers.join(', ')}`);
          this.toastService.showToast(textWin, 'success');
        }
      }
    }, 900);
  }

  public skipVietlott() {
    if (this.vietlottIntervalId) {
      clearInterval(this.vietlottIntervalId);
      this.vietlottIntervalId = null;
    }
    
    const type = this.selectedVietlottType();
    const resultObj = this.getVietlottResults(type);
    
    this.vietlottNumbers.set(resultObj.numbers);
    if (type === 'Power655') {
      this.vietlottBonus.set(resultObj.bonus || null);
    } else {
      this.vietlottBonus.set(null);
    }
    
    const totalBalls = type === 'Keno' ? 20 : (type === 'Power655' ? 7 : 6);
    this.revealedCount.set(totalBalls);
    this.isVietlottDrawing.set(false);
    this.vietlottDone.set(true);
    
    const textWin = type === 'Keno' 
      ? 'Bảng số Keno đã được chốt!'
      : (type === 'Power655' 
          ? `Bộ số Power 6/55: ${resultObj.numbers.join(', ')} | Số phụ: ${resultObj.bonus}`
          : `Bộ số Mega 6/45: ${resultObj.numbers.join(', ')}`);
    this.toastService.showToast(textWin, 'success');
  }


  ngOnDestroy() {
    if (this.vietlottIntervalId) clearInterval(this.vietlottIntervalId);
  }
}
