import { Component, input, output, signal, HostListener, inject, ElementRef, OnDestroy } from '@angular/core';
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
      <!-- Nút kích hoạt Dropdown -->
      <button
        type="button"
        (click)="toggleOpen()"
        class="form-input flex items-center justify-between px-4 text-left transition-all cursor-pointer border border-slate-200/40 dark:border-slate-800/40 bg-slate-50 dark:bg-slate-950/40 focus:outline-none focus:border-[var(--color-primary)]/80 focus:ring-1 focus:ring-[var(--color-primary)]/10"
        [class.border-[var(--color-primary)]]="isOpen()"
      >
        <span class="font-semibold truncate text-slate-700 dark:text-slate-200">
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
      </button>

      <!-- Khối Dropdown Menu (Fixed Positioning để tránh bị cắt bởi overflow:hidden) -->
      <div
        *ngIf="isOpen()"
        class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-[0_10px_30px_-5px_rgba(0,0,0,0.08)] dark:shadow-[0_10px_30px_-5px_rgba(0,0,0,0.3)] animate-in fade-in slide-in-from-top-1 duration-150 flex flex-col overflow-y-auto"
        [ngStyle]="dropdownStyle()"
      >
        <div class="py-1">
          <button
            *ngFor="let option of options()"
            type="button"
            (click)="selectOption(option)"
            class="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 text-xs font-semibold text-slate-700 dark:text-slate-300 text-left transition-colors cursor-pointer"
          >
            <span class="truncate" [class.text-[var(--color-primary)]]="value() === option.value">
              {{ option.label }}
            </span>
            <!-- Checkmark SVG -->
            <svg
              *ngIf="value() === option.value"
              class="h-4 w-4 text-[var(--color-primary)] shrink-0 ml-2 animate-in fade-in duration-200"
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
export class SelectComponent implements OnDestroy {
  private readonly elementRef = inject(ElementRef);

  options = input<SelectOption[]>([]);
  value = input<any>(null);
  valueChange = output<any>();

  isOpen = signal<boolean>(false);
  dropdownStyle = signal<{ [key: string]: string }>({});
  private scrollListener: (() => void) | null = null;

  selectedLabel(): string {
    const selected = this.options().find(opt => opt.value === this.value());
    return selected ? selected.label : 'Chọn tùy chọn...';
  }

  toggleOpen() {
    const nextState = !this.isOpen();
    if (nextState) {
      this.updateDropdownPosition();
      this.isOpen.set(nextState);
      this.addScrollListeners();
    } else {
      this.isOpen.set(nextState);
      this.removeScrollListeners();
    }
  }

  selectOption(option: SelectOption) {
    this.valueChange.emit(option.value);
    this.isOpen.set(false);
    this.removeScrollListeners();
  }

  // Tự động tính toán vị trí fixed
  public updateDropdownPosition(): void {
    const trigger = this.elementRef.nativeElement.querySelector('button');
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Chiều cao ước lượng tối đa của dropdown menu
    const dropdownHeight = 240;
    let placement: 'top' | 'bottom' = 'bottom';
    
    // Tự động chọn hướng hiển thị (trên/dưới)
    if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
      placement = 'top';
    }

    const viewportWidth = window.innerWidth;
    const dropdownMinWidth = Math.max(160, rect.width);
    let left = rect.left;

    // Tránh bị tràn lề phải màn hình
    if (left + dropdownMinWidth > viewportWidth - 16) {
      left = Math.max(16, viewportWidth - dropdownMinWidth - 16);
    }

    const styles: { [key: string]: string } = {
      position: 'fixed',
      left: `${left}px`,
      minWidth: `${dropdownMinWidth}px`,
      width: 'max-content',
      maxWidth: '320px',
      zIndex: '9999',
    };

    if (placement === 'bottom') {
      styles['top'] = `${rect.bottom + 6}px`;
      styles['max-height'] = `${Math.min(dropdownHeight, spaceBelow - 16)}px`;
    } else {
      styles['bottom'] = `${viewportHeight - rect.top + 6}px`;
      styles['max-height'] = `${Math.min(dropdownHeight, spaceAbove - 16)}px`;
    }

    this.dropdownStyle.set(styles);
  }

  private addScrollListeners(): void {
    this.removeScrollListeners();

    const updatePos = () => {
      if (this.isOpen()) {
        this.updateDropdownPosition();
      }
    };

    // Lắng nghe capture mode để bắt sự kiện scroll của mọi container cha
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos, true);

    this.scrollListener = updatePos;
  }

  private removeScrollListeners(): void {
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener, true);
      window.removeEventListener('resize', this.scrollListener, true);
      this.scrollListener = null;
    }
  }

  @HostListener('document:click', ['$event'])
  public onClickOutside(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
      this.removeScrollListeners();
    }
  }

  ngOnDestroy(): void {
    this.removeScrollListeners();
  }
}
