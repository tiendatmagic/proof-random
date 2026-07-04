import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (toastService.successMessage(); as success) {
      <div 
        [attr.data-id]="success.id" 
        class="toast-animate z-[9999] flex items-center gap-3.5 pl-4 pr-3 py-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 shadow-[0_15px_40px_rgba(0,0,0,0.08)] dark:shadow-[0_15px_40px_rgba(0,0,0,0.4)] min-w-[320px] max-w-[420px] overflow-hidden"
        style="bottom: 24px; right: 24px; position: fixed;"
      >
        <!-- Icon Success (Tròn xanh lá, tick trắng) -->
        <div class="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/25">
          <svg class="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        <!-- Tin nhắn -->
        <span class="text-xs md:text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug">{{ success.msg }}</span>
        
        <!-- Nút đóng x -->
        <button 
          (click)="toastService.clear()" 
          class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer ml-auto shrink-0"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <!-- Progress Bar ở đáy -->
        <div class="toast-progress-success absolute bottom-0 left-0 h-1 bg-emerald-500 w-full"></div>
      </div>
    }

    @if (toastService.errorMessage(); as error) {
      <div 
        [attr.data-id]="error.id" 
        class="toast-animate z-[9999] flex items-center gap-3.5 pl-4 pr-3 py-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 shadow-[0_15px_40px_rgba(0,0,0,0.08)] dark:shadow-[0_15px_40px_rgba(0,0,0,0.4)] min-w-[320px] max-w-[420px] overflow-hidden"
        style="bottom: 24px; right: 24px; position: fixed;"
      >
        <!-- Icon Error (Tròn đỏ, nhân trắng) -->
        <div class="w-6 h-6 rounded-full bg-rose-500 flex items-center justify-center shrink-0 shadow-sm shadow-rose-500/25">
          <svg class="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        
        <!-- Tin nhắn -->
        <span class="text-xs md:text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug">{{ error.msg }}</span>
        
        <!-- Nút đóng x -->
        <button 
          (click)="toastService.clear()" 
          class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer ml-auto shrink-0"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <!-- Progress Bar ở đáy -->
        <div class="toast-progress-error absolute bottom-0 left-0 h-1 bg-rose-500 w-full"></div>
      </div>
    }
  `
})
export class ToastComponent {
  public readonly toastService = inject(ToastService);
}
