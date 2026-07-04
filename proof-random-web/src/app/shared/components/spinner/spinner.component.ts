import { Component, input } from '@angular/core';

@Component({
  selector: 'app-spinner',
  standalone: true,
  template: `
    <div 
      [class]="sizeClass() + ' border-slate-200 dark:border-slate-800 border-t-[var(--color-primary)] rounded-full animate-spin'"
    ></div>
  `,
  styles: [`
    :host {
      display: inline-block;
    }
  `]
})
export class SpinnerComponent {
  size = input<'sm' | 'md' | 'lg'>('md');
  
  sizeClass() {
    switch (this.size()) {
      case 'sm': return 'w-4 h-4 border-2';
      case 'lg': return 'w-12 h-12 border-4';
      case 'md':
      default: return 'w-10 h-10 border-2';
    }
  }
}
