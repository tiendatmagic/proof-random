import { Component, signal, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseGameComponent } from '../base-game.component';
import { Web3Service } from '../../../../../../core/services/web3.service';
import { ToastService } from '../../../../../../core/services/toast.service';
import { inject } from '@angular/core';

@Component({
  selector: 'app-scratch-card-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scratch-card-game.component.html'
})
export class ScratchCardGameComponent extends BaseGameComponent implements OnDestroy {
  constructor() {
    super();
    effect(() => {
      const details = this.sessionDetails();
      const res = this.clientResult();
      if (details && res) {
        this.initScratchCard();
      }
    });
  }
  public readonly web3Service = inject(Web3Service);
  private readonly toastService = inject(ToastService);

  // Signals riêng của game
  

  // Timers riêng của game
  

    // 5. Vé số cào (Scratch Card)
  public readonly isScratched = signal<boolean>(false);
  public readonly scratchDone = signal<boolean>(false);
  
  public initScratchCard() {
    setTimeout(() => {
      const canvas = document.getElementById('scratchCanvas') as HTMLCanvasElement;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
      const grad = ctx.createLinearGradient(0, 0, 240, 120);
      if (isDark) {
        grad.addColorStop(0, '#1e293b');
        grad.addColorStop(1, '#334155');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 240, 120);
        
        ctx.font = 'bold 11px Quicksand, sans-serif';
        ctx.fillStyle = '#94a3b8';
      } else {
        grad.addColorStop(0, '#f1f5f9');
        grad.addColorStop(1, '#cbd5e1');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 240, 120);
        
        ctx.font = 'bold 11px Quicksand, sans-serif';
        ctx.fillStyle = '#475569';
      }
      ctx.textAlign = 'center';
      ctx.fillText('DI CHUỘT CÀO LỚP BẠC', 120, 65);
      
      let isDrawing = false;
      const scratch = (x: number, y: number) => {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(x, y, 16, 0, Math.PI * 2);
        ctx.fill();
      };
      
      const getPos = (e: MouseEvent | TouchEvent) => {
        const rect = canvas.getBoundingClientRect();
        if (e instanceof MouseEvent) {
          return { x: e.clientX - rect.left, y: e.clientY - rect.top };
        } else {
          return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
        }
      };
      
      canvas.onmousedown = () => isDrawing = true;
      canvas.onmouseup = () => isDrawing = false;
      canvas.onmousemove = (e) => {
        if (!isDrawing) return;
        const pos = getPos(e);
        scratch(pos.x, pos.y);
        this.isScratched.set(true);
      };
      
      canvas.ontouchstart = () => isDrawing = true;
      canvas.ontouchend = () => isDrawing = false;
      canvas.ontouchmove = (e) => {
        e.preventDefault();
        if (!isDrawing) return;
        const pos = getPos(e);
        scratch(pos.x, pos.y);
        this.isScratched.set(true);
      };
    }, 100);
  }
  
  public autoScratch() {
    this.isScratched.set(true);
    this.scratchDone.set(true);
    const canvas = document.getElementById('scratchCanvas') as HTMLCanvasElement;
    if (canvas) {
      canvas.style.opacity = '0';
      setTimeout(() => canvas.style.display = 'none', 300);
    }
  }


  ngOnDestroy() {

  }
}
