import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  public readonly isDarkMode = signal<boolean>(false);
  public readonly themeMode = signal<'light' | 'auto' | 'dark'>('light');

  constructor() {
    this.initTheme();
  }

  /**
   * Khởi tạo Light/Dark/Auto Theme từ localStorage
   */
  private initTheme() {
    if (typeof window === 'undefined') return;
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'auto' | null;

    if (savedTheme === 'auto') {
      this.themeMode.set('auto');
      this.applyAutoTheme();
    } else if (savedTheme === 'dark') {
      this.themeMode.set('dark');
      this.applyDarkClass(true);
    } else {
      this.themeMode.set('light');
      this.applyDarkClass(false);
    }
  }

  private isNightTime(): boolean {
    const hour = new Date().getHours();
    return hour >= 18 || hour < 6;
  }

  public applyDarkClass(dark: boolean) {
    this.isDarkMode.set(dark);
    if (typeof document !== 'undefined') {
      if (dark) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');
      }
    }
  }

  public applyAutoTheme() {
    this.applyDarkClass(this.isNightTime());
  }

  public setThemeMode(mode: 'light' | 'auto' | 'dark') {
    this.themeMode.set(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', mode);
    }
    if (mode === 'auto') {
      this.applyAutoTheme();
    } else {
      this.applyDarkClass(mode === 'dark');
    }
  }

  public toggleTheme() {
    const current = this.themeMode();
    if (current === 'light') {
      this.setThemeMode('auto');
    } else if (current === 'auto') {
      this.setThemeMode('dark');
    } else {
      this.setThemeMode('light');
    }
  }
}
