import { Component, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseGameComponent } from '../base-game.component';
import { Web3Service } from '../../../../../../core/services/web3.service';
import { ToastService } from '../../../../../../core/services/toast.service';
import { inject } from '@angular/core';

@Component({
  selector: 'app-plinko-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './plinko-game.component.html'
})
export class PlinkoGameComponent extends BaseGameComponent implements OnDestroy {
  public readonly web3Service = inject(Web3Service);
  private readonly toastService = inject(ToastService);

  // Signals riêng của game
  public readonly isPlinkoRunning = signal<boolean>(false);
  public readonly plinkoDone = signal<boolean>(false);

  // Timers riêng của game
    private plinkoAnimationFrameId: any = null;

    // ================= 7. PLINKO BOARD MAY MẮN =================
  public initPlinkoCanvas() {
    setTimeout(() => {
      const canvas = document.getElementById('plinkoCanvas') as HTMLCanvasElement;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      this.drawPlinkoBoard(ctx, canvas.width, canvas.height, 12, null, null);
    }, 100);
  }

  private drawPlinkoBoard(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    rows: number,
    ballX: number | null,
    ballY: number | null
  ) {
    ctx.clearRect(0, 0, width, height);
    
    // Background tối giản sang trọng
    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    ctx.fillStyle = isDark ? '#020617' : '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    // Vẽ lưới đinh tam giác (peg board)
    ctx.fillStyle = isDark ? '#475569' : '#cbd5e1';
    const startY = 40;
    const rowSpacing = (height - 80) / rows;
    
    for (let r = 0; r < rows; r++) {
      const pinsInRow = r + 3;
      const rowWidth = pinsInRow * 20;
      const startX = (width - rowWidth) / 2 + 10;
      for (let p = 0; p < pinsInRow; p++) {
        ctx.beginPath();
        ctx.arc(startX + p * 20, startY + r * rowSpacing, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Vẽ quả bóng Plinko màu hồng Neon
    if (ballX !== null && ballY !== null) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(ballX, ballY, 7.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ff00dd';
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#ff00dd';
      ctx.fill();
      ctx.restore();
    } else {
      // Vẽ bóng ở vị trí thả mặc định
      ctx.beginPath();
      ctx.arc(width / 2, 20, 7.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ff00dd';
      ctx.fill();
    }

    // Vẽ các khe ở đáy bảng Plinko
    const details = this.sessionDetails();
    if (details && details.participants) {
      const participantsList = Array.from(details.participants || []) as string[];
      const count = participantsList.length;
      const winnerIdx = Number(details.result);
      const winnerName = participantsList[winnerIdx] || 'Winner';

      let totalBins = 9;
      let targetBinIdx = 4;
      
      if (count <= 9) {
        totalBins = count;
        targetBinIdx = winnerIdx;
      } else {
        totalBins = 9;
        targetBinIdx = 4;
      }
      
      const binNames = new Array(totalBins).fill('');
      if (count <= 9) {
        for (let i = 0; i < count; i++) {
          binNames[i] = participantsList[i];
        }
      } else {
        binNames[targetBinIdx] = winnerName;
        let othersIdx = 0;
        const others = participantsList.filter((p: string) => p !== winnerName);
        for (let b = 0; b < totalBins; b++) {
          if (b !== targetBinIdx) {
            binNames[b] = others[othersIdx] || '';
            othersIdx++;
          }
        }
      }

      const binWidth = width / totalBins;
      ctx.fillStyle = isDark ? '#0f172a' : '#e2e8f0';
      ctx.strokeStyle = isDark ? '#1e293b' : '#cbd5e1';
      ctx.lineWidth = 1;
      
      ctx.font = 'bold 9px Quicksand, sans-serif';
      ctx.textAlign = 'center';

      for (let b = 0; b < totalBins; b++) {
        const x = b * binWidth;
        // Vẽ vách ngăn khe
        ctx.beginPath();
        ctx.moveTo(x, height - 30);
        ctx.lineTo(x, height);
        ctx.stroke();

        // Vẽ chữ kết quả
        const name = binNames[b] || '';
        const displayName = name.length > 8 ? name.substring(0, 6) + '..' : name;
        ctx.fillStyle = b === targetBinIdx ? '#ff00dd' : '#64748b';
        ctx.fillText(displayName, x + binWidth / 2, height - 10);
      }
    }
  }

  public startPlinko() {
    if (this.isPlinkoRunning() || this.plinkoDone()) return;
    this.isPlinkoRunning.set(true);

    const canvas = document.getElementById('plinkoCanvas') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const rows = 12;

    const details = this.sessionDetails();
    if (!details || !details.participants) return;

    const participantsList = Array.from(details.participants || []) as string[];
    const count = participantsList.length;
    const winnerIdx = Number(details.result);

    let totalBins = 9;
    let targetBinIdx = 4;

    if (count <= 9) {
      totalBins = count;
      targetBinIdx = winnerIdx;
    } else {
      totalBins = 9;
      targetBinIdx = 4;
    }

    const binWidth = width / totalBins;
    const targetX = targetBinIdx * binWidth + binWidth / 2;

    let currentX = width / 2;
    let currentY = 20;
    let vy = 2.5;

    const animate = () => {
      currentY += vy;

      // Nảy ngang nhẹ theo lực hút kéo dần về trục đích
      const distanceToBottom = height - 30 - currentY;
      if (distanceToBottom > 20) {
        const dx = targetX - currentX;
        const drift = dx / (distanceToBottom / 5.5);
        currentX += drift + (Math.random() - 0.5) * 2;
      } else {
        const dx = targetX - currentX;
        currentX += dx * 0.2;
      }

      this.drawPlinkoBoard(ctx, width, height, rows, currentX, currentY);

      if (currentY < height - 20) {
        this.plinkoAnimationFrameId = requestAnimationFrame(animate);
      } else {
        this.isPlinkoRunning.set(false);
        this.plinkoDone.set(true);
        this.toastService.showToast(`Chúc mừng ${participantsList[winnerIdx]} đã chiến thắng Plinko!`, 'success');
      }
    };

    this.plinkoAnimationFrameId = requestAnimationFrame(animate);
  }

  public skipPlinko() {
    if (this.plinkoAnimationFrameId) {
      cancelAnimationFrame(this.plinkoAnimationFrameId);
      this.plinkoAnimationFrameId = null;
    }
    this.isPlinkoRunning.set(false);
    this.plinkoDone.set(true);
    this.initPlinkoCanvas();
    this.toastService.showToast(`Chúc mừng ${this.clientResult().winners[0]} đã chiến thắng Plinko!`, 'success');
  }


  ngOnDestroy() {
    if (this.plinkoAnimationFrameId) clearTimeout(this.plinkoAnimationFrameId);
  }
}
