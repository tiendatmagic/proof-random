import { Component, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseGameComponent } from '../base-game.component';
import { Web3Service } from '../../../../../../core/services/web3.service';
import { ToastService } from '../../../../../../core/services/toast.service';
import { inject } from '@angular/core';

@Component({
  selector: 'app-lucky-wheel-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './lucky-wheel-game.component.html'
})
export class LuckyWheelGameComponent extends BaseGameComponent implements OnDestroy {
  public readonly web3Service = inject(Web3Service);
  private readonly toastService = inject(ToastService);

  // Signals riêng của game
  

  // Timers riêng của game
    private wheelAnimationFrameId: any = null;

    // 1. Vòng quay may mắn (Lucky Wheel)
  public readonly isWheelSpinning = signal<boolean>(false);
  public readonly wheelSpinDone = signal<boolean>(false);
  
  public initWheelCanvas() {
    setTimeout(() => {
      const canvas = document.getElementById('wheelCanvas') as HTMLCanvasElement;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const details = this.sessionDetails();
      if (!details || !details.participants) return;
      
      const participants = details.participants;
      const numSegments = participants.length;
      const anglePerSeg = (2 * Math.PI) / numSegments;
      
      // Nếu đã quay xong, xoay vòng quay đến người chiến thắng
      let startAngle = 0;
      if (this.wheelSpinDone() && details.result !== undefined && details.result !== null && details.result !== '') {
        const winnerIdx = Number(details.result);
        startAngle = (2 * Math.PI) - (winnerIdx * anglePerSeg + anglePerSeg / 2) - (Math.PI / 2);
      }
      
      ctx.save();
      ctx.clearRect(0, 0, 300, 300);
      ctx.translate(150, 150);
      ctx.rotate(startAngle);
      ctx.translate(-150, -150);
      
      const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
      for (let i = 0; i < numSegments; i++) {
        ctx.beginPath();
        ctx.moveTo(150, 150);
        ctx.arc(150, 150, 140, i * anglePerSeg, (i + 1) * anglePerSeg);
        ctx.closePath();
        
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 0, 221, 0.15)' : 'rgba(128, 0, 255, 0.15)';
        ctx.strokeStyle = 'rgba(255, 0, 221, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();
        
        ctx.save();
        ctx.translate(150, 150);
        ctx.rotate(i * anglePerSeg + anglePerSeg / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = isDark ? '#cbd5e1' : '#334155';
        ctx.font = 'bold 11px Quicksand, sans-serif';
        const displayName = participants[i].length > 12 ? participants[i].substring(0, 10) + '..' : participants[i];
        ctx.fillText(displayName, 130, 4);
        ctx.restore();
      }
      ctx.restore();
    }, 100);
  }
  
  public spinWheel() {
    if (this.isWheelSpinning() || this.wheelSpinDone()) return;
    this.isWheelSpinning.set(true);
    
    const details = this.sessionDetails();
    if (!details || !details.result) return;
    const winnerIdx = Number(details.result);
    const numSegments = details.participants.length;
    
    const canvas = document.getElementById('wheelCanvas') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const anglePerSeg = (2 * Math.PI) / numSegments;
    const targetAngle = (2 * Math.PI) - (winnerIdx * anglePerSeg + anglePerSeg / 2) - (Math.PI / 2);
    
    // Thêm 8 vòng xoay đầy để tăng độ kịch tính
    const totalRotation = targetAngle + 16 * Math.PI;
    
    let startTimestamp: number | null = null;
    const duration = 5000; // 5s
    
    const animate = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);
      
      const easeProgress = 1 - Math.pow(1 - progress, 3); // cubic ease out
      const currentAngle = easeProgress * totalRotation;
      
      ctx.save();
      ctx.clearRect(0, 0, 300, 300);
      ctx.translate(150, 150);
      ctx.rotate(currentAngle);
      ctx.translate(-150, -150);
      
      const participants = details.participants;
      for (let i = 0; i < numSegments; i++) {
        ctx.beginPath();
        ctx.moveTo(150, 150);
        ctx.arc(150, 150, 140, i * anglePerSeg, (i + 1) * anglePerSeg);
        ctx.closePath();
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 0, 221, 0.15)' : 'rgba(128, 0, 255, 0.15)';
        ctx.strokeStyle = 'rgba(255, 0, 221, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();
        
        ctx.save();
        ctx.translate(150, 150);
        ctx.rotate(i * anglePerSeg + anglePerSeg / 2);
        ctx.textAlign = 'right';
        const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
        ctx.fillStyle = isDark ? '#cbd5e1' : '#334155';
        ctx.font = 'bold 11px Quicksand, sans-serif';
        const displayName = participants[i].length > 12 ? participants[i].substring(0, 10) + '..' : participants[i];
        ctx.fillText(displayName, 130, 4);
        ctx.restore();
      }
      ctx.restore();
      
      if (progress < 1) {
        this.wheelAnimationFrameId = requestAnimationFrame(animate);
      } else {
        this.isWheelSpinning.set(false);
        this.wheelSpinDone.set(true);
        this.toastService.showToast(`Chúc mừng ${this.clientResult().winners[0]} đã chiến thắng!`, 'success');
      }
    };
    
    this.wheelAnimationFrameId = requestAnimationFrame(animate);
  }


  

  public skipWheel() {
    this.isWheelSpinning.set(false);
    this.wheelSpinDone.set(true);
    this.initWheelCanvas();
  }

  ngOnDestroy() {
    if (this.wheelAnimationFrameId) clearTimeout(this.wheelAnimationFrameId);
  }
}
