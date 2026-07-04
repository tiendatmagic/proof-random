import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-skeleton-loader',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="animate-pulse-slow w-full" [ngSwitch]="type()">
      
      <!-- Stats skeleton -->
      <div *ngSwitchCase="'stats'" class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div *ngFor="let i of [1,2,3]" class="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-[15px] p-6 h-[98px] flex items-center gap-4 shadow-sm">
          <div class="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-800/80"></div>
          <div class="flex-1 space-y-2.5">
            <div class="h-3 bg-slate-200 dark:bg-slate-800/80 rounded w-2/3"></div>
            <div class="h-6 bg-slate-200 dark:bg-slate-800/80 rounded w-1/3"></div>
          </div>
        </div>
      </div>

      <!-- Table skeleton -->
      <div *ngSwitchCase="'table'" class="p-6 space-y-4">
        <!-- Table header mimic -->
        <div class="flex gap-4 border-b border-slate-100 dark:border-slate-800/50 pb-4">
          <div class="h-4 bg-slate-200 dark:bg-slate-800/80 rounded w-1/4"></div>
          <div class="h-4 bg-slate-200 dark:bg-slate-800/80 rounded flex-1"></div>
          <div class="h-4 bg-slate-200 dark:bg-slate-800/80 rounded w-1/6"></div>
          <div class="h-4 bg-slate-200 dark:bg-slate-800/80 rounded w-1/6"></div>
        </div>
        <!-- Table rows mimic -->
        <div *ngFor="let i of [1,2,3,4,5]" class="flex gap-4 items-center py-2 border-b border-slate-50 dark:border-slate-800/20">
          <div class="h-3.5 bg-slate-100 dark:bg-slate-800/60 rounded w-1/4"></div>
          <div class="h-3.5 bg-slate-100 dark:bg-slate-800/60 rounded flex-1"></div>
          <div class="h-3.5 bg-slate-100 dark:bg-slate-800/60 rounded w-1/6"></div>
          <div class="h-6 bg-slate-100 dark:bg-slate-800/60 rounded w-20"></div>
        </div>
      </div>

      <!-- Form skeleton -->
      <div *ngSwitchCase="'form'" class="p-6 space-y-6">
        <div class="h-5 bg-slate-200 dark:bg-slate-800/80 rounded w-1/3 border-b border-slate-100 dark:border-slate-800/50 pb-6"></div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="space-y-2">
            <div class="h-3 bg-slate-100 dark:bg-slate-800/60 rounded w-1/4"></div>
            <div class="h-[42px] bg-slate-100 dark:bg-slate-800/60 rounded-xl"></div>
          </div>
          <div class="space-y-2">
            <div class="h-3 bg-slate-100 dark:bg-slate-800/60 rounded w-1/4"></div>
            <div class="h-[42px] bg-slate-100 dark:bg-slate-800/60 rounded-xl"></div>
          </div>
        </div>
        <div class="space-y-2">
          <div class="h-3 bg-slate-100 dark:bg-slate-800/60 rounded w-1/4"></div>
          <div class="h-28 bg-slate-100 dark:bg-slate-800/60 rounded-xl"></div>
        </div>
      </div>

      <!-- Detail skeleton -->
      <div *ngSwitchCase="'detail'" class="space-y-6">
        <div class="flex justify-between items-center">
          <div class="h-4 bg-slate-200 dark:bg-slate-800/80 rounded w-24"></div>
          <div class="h-6 bg-slate-200 dark:bg-slate-800/80 rounded w-32"></div>
        </div>
        
        <div class="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-[15px] p-6 h-[110px] flex items-center justify-between gap-6 shadow-sm">
          <div class="space-y-2.5 flex-1">
            <div class="h-4 bg-slate-200 dark:bg-slate-800/80 rounded w-1/6"></div>
            <div class="h-6 bg-slate-200 dark:bg-slate-800/80 rounded w-1/3"></div>
          </div>
          <div class="h-9 bg-slate-200 dark:bg-slate-800/80 rounded-xl w-32"></div>
        </div>

        <div class="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-[15px] p-6 h-[250px] flex flex-col justify-center items-center gap-4 shadow-sm">
          <div class="h-3 bg-slate-200 dark:bg-slate-800/80 rounded w-24"></div>
          <div class="h-12 bg-slate-200 dark:bg-slate-800/80 rounded w-1/3"></div>
          <div class="h-3 bg-slate-200 dark:bg-slate-800/80 rounded w-16"></div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }
  `]
})
export class SkeletonLoaderComponent {
  type = input<'stats' | 'table' | 'form' | 'detail'>('table');
}
