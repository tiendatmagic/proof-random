import { Component, input, output, signal, HostListener, inject, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface SelectOption {
  value: any;
  label: string;
}

@Component({
  selector: 'app-select',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative w-full select-none text-left">
      <!-- Nút hiển thị giá trị đang chọn -->
      <div
        (click)="toggleDropdown()"
        class="form-input flex items-center justify-between cursor-pointer select-none border border-slate-200/40 dark:border-slate-800/40 bg-slate-50 dark:bg-slate-950/40 focus-within:border-[var(--color-primary)] transition-all duration-200"
      >
        <span class="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
          {{ selectedLabel() }}
        </span>
        <!-- Chevron icon -->
        <svg
          class="h-4 w-4 text-slate-400 transition-transform duration-200 shrink-0 ml-2"
          [class.rotate-180]="isOpen()"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2.5"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      <!-- Dropdown Menu tùy chọn -->
      <div
        *ngIf="isOpen()"
        class="absolute left-0 mt-2 z-50 w-full p-1.5 app-card shadow-2xl border border-slate-200/50 dark:border-slate-800/50 rounded-2xl bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 animate-fadeIn max-h-60 overflow-y-auto"
      >
        <div class="space-y-0.5">
          <button
            *ngFor="let option of options()"
            type="button"
            (click)="selectOption(option)"
            class="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:text-[var(--color-primary)] dark:hover:text-white transition-all text-left cursor-pointer"
            [class.bg-purple-50]="value() === option.value"
            [class.dark:bg-purple-950/20]="value() === option.value"
            [class.text-[var(--color-primary)]]="value() === option.value"
            [class.dark:text-[var(--color-primary)]]="value() === option.value"
          >
            <span>{{ option.label }}</span>
            <!-- Checkmark icon if selected -->
            <svg
              *ngIf="value() === option.value"
              class="h-4 w-4 text-[var(--color-primary)] shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="3"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class SelectComponent {
  private readonly elementRef = inject(ElementRef);

  options = input<SelectOption[]>([]);
  value = input<any>(null);
  valueChange = output<any>();

  isOpen = signal<boolean>(false);

  /**
   * Lấy nhãn hiển thị của tùy chọn đang được chọn
   */
  selectedLabel(): string {
    const selected = this.options().find(opt => opt.value === this.value());
    return selected ? selected.label : 'Chọn tùy chọn...';
  }

  toggleDropdown() {
    this.isOpen.set(!this.isOpen());
  }

  selectOption(option: SelectOption) {
    this.valueChange.emit(option.value);
    this.isOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!this.elementRef.nativeElement.contains(target)) {
      this.isOpen.set(false);
    }
  }
}
