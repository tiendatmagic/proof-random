import { Component, input, output, signal, HostBinding, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-checkbox',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <label
      class="group flex items-center gap-2.5 cursor-pointer select-none"
      [class.opacity-50]="disabled()"
      [class.pointer-events-none]="disabled()"
    >
      <!-- Khung check custom -->
      <div
        class="relative shrink-0 flex items-center justify-center h-4.5 w-4.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 transition-all duration-200"
        [class.bg-[var(--color-primary)]]="checked()"
        [class.border-[var(--color-primary)]]="checked()"
        [class.shadow-sm]="checked()"
        [class.shadow-[var(--color-primary)]/20]="checked()"
        [class.group-hover:border-slate-400]="!checked() && !disabled()"
        [class.dark:group-hover:border-slate-600]="!checked() && !disabled()"
      >
        <!-- Icon tick trắng -->
        <svg
          *ngIf="checked()"
          class="h-3 w-3 text-white stroke-[3px] animate-in fade-in duration-150"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <!-- Input checkbox gốc (Ẩn đi, phục vụ accessibility) -->
      <input
        type="checkbox"
        [checked]="checked()"
        (change)="onToggle($event)"
        [disabled]="disabled()"
        class="sr-only"
      />

      <!-- Nhãn hiển thị -->
      <span *ngIf="label()" class="text-xs font-bold text-slate-600 dark:text-slate-300 leading-none pt-0.5">
        {{ label() }}
      </span>
      <ng-content *ngIf="!label()"></ng-content>
    </label>
  `,
  styles: [`
    :host {
      display: inline-block;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CheckboxComponent {
  checked = input<boolean>(false);
  disabled = input<boolean>(false);
  label = input<string>('');

  checkedChange = output<boolean>();

  onToggle(event: Event) {
    if (this.disabled()) return;
    const isChecked = (event.target as HTMLInputElement).checked;
    this.checkedChange.emit(isChecked);
  }
}
