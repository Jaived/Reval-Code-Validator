import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private darkMode = signal(this.isDarkPreferred());
  isDark = this.darkMode.asReadonly();

  constructor( @Inject(PLATFORM_ID) private platformId: Object) {
    // Watch for system theme changes
     if(!isPlatformBrowser(this.platformId)) return ;
    window.matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', e => this.setDarkMode(e.matches));
    // Ensure document class reflects the current preference on startup (browser only)
    this.setDarkMode(this.darkMode());
  }

  private isDarkPreferred(): boolean {
 if(!isPlatformBrowser(this.platformId)) return false;
    const stored = localStorage.getItem('darkMode');
    if (stored !== null) {
      return stored === 'true';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;

  }

  toggleTheme(): void {
    this.setDarkMode(!this.darkMode());
  }

  private setDarkMode(isDark: boolean): void {
    this.darkMode.set(isDark);
    localStorage.setItem('darkMode', String(isDark));
    document.documentElement.classList.toggle('dark', isDark);
  }
}