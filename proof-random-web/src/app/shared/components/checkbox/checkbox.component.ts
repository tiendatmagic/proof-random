import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-checkbox',
  standalone: true,
  imports: [CommonModule],
  template: `
    <label
      class="group flex items-center gap-2.5 cursor-pointer select-none"
      [class.opacity-50]="disabled"
      [class.pointer-events-none]="disabled"
    >
      <!-- Khung check custom -->
      <div
        class="relative mt-0.5 shrink-0 flex items-center justify-center h-4.5 w-4.5 rounded border transition-all duration-200"
        [ngClass]="
          checked()
            ? 'bg-[var(--color-primary)] border-[var(--color-primary)] shadow-sm shadow-[var(--color-primary)]/20'
            : 'bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 group-hover:border-slate-400 dark:group-hover:border-slate-600'
        "
      >
        @if (checked()) {
          <svg
            class="h-3 w-3 text-white stroke-[3px]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        }
      </div>

      <!-- Input checkbox gốc (ẩn, phục vụ accessibility và trigger change) -->
      <input
        type="checkbox"
        [checked]="checked()"
        (change)="onToggle($event)"
        [disabled]="disabled"
        class="sr-only"
      />

      <!-- Nhãn -->
      @if (label) {
        <span class="text-xs font-bold text-slate-600 dark:text-slate-300 leading-none">
          {{ label }}
        </span>
      } @else {
        <ng-content></ng-content>
      }
    </label>
  `,
  styles: [`
    :host { display: block; }
  `],
  changeDetection: ChangeDetectionStrategy.Eager
})
export class CheckboxComponent {
  public readonly checked = signal<boolean>(false);

  @Input() label: string = '';
  @Input() disabled: boolean = false;

  @Input('checked') set setChecked(value: boolean) {
    this.checked.set(!!value);
  }

  @Output() checkedChange = new EventEmitter<boolean>();

  public onToggle(event: Event): void {
    if (this.disabled) return;
    const isChecked = (event.target as HTMLInputElement).checked;
    this.checked.set(isChecked);
    this.checkedChange.emit(isChecked);
  }
}
