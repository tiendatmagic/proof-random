import { Component, inject, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Web3Service } from '../../../core/services/web3.service';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './sidebar.component.html'
})
export class SidebarComponent {
  @Input() isOpen = false;
  @Output() closeSidebar = new EventEmitter<void>();

  public readonly web3Service = inject(Web3Service);
  public readonly themeService = inject(ThemeService);

  public onLinkClick() {
    this.closeSidebar.emit();
  }

  public onCustomGasMultiplierChange(value: number) {
    if (value && value >= 1.0) {
      this.web3Service.setGasMultiplier(value);
    }
  }
}
