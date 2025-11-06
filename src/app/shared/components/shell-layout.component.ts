import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NgIf } from '@angular/common';
import { ThemeService } from '../../core/services/theme.service';
import { ToastContainerComponent } from './toast-container.component';

@Component({
  selector: 'app-shell-layout',
  standalone: true,
  imports: [RouterModule, NgIf, ToastContainerComponent],
  template: `
    <div class="d-flex flex-column min-vh-100">
      <header class="app-header py-3">
        <div class="container d-flex align-items-center justify-content-between">
          <div class="d-flex align-items-center">
            <div class="brand me-3">
              <span class="brand-logo">RC</span>
              <div class="d-flex flex-column">
                <div>Reval Code Validator</div>
                <small class="brand-tag">Validate · Compare · Report</small>
              </div>
            </div>
          </div>

          <nav class="app-nav d-flex align-items-center">
            <a class="nav-link d-inline-block" routerLink="/validate" routerLinkActive="active">Validate</a>
            <a class="nav-link d-inline-block" routerLink="/compare-css" routerLinkActive="active">Compare Files</a>
            <a class="nav-link d-inline-block" routerLink="/report" routerLinkActive="active">Report</a>
            <a class="nav-link d-inline-block" routerLink="/quality" routerLinkActive="active">Quality</a>

            <div class="nav-actions ms-3">
              <!-- Search removed: not currently wired to any feature. If needed, we can re-add and wire to a search service. -->
              <button (click)="toggleTheme()" class="btn btn-sm btn-outline-light ms-2" [attr.aria-label]="'Toggle ' + (isDark ? 'light' : 'dark') + ' mode'">
                <svg *ngIf="!isDark" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="me-1"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"></path></svg>
                <svg *ngIf="isDark" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="me-1"><circle cx="12" cy="12" r="3"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path></svg>
                <span *ngIf="!isDark">Dark</span>
                <span *ngIf="isDark">Light</span>
              </button>

              <!-- Profile / avatar (visual placeholder) -->
              <button class="btn btn-sm btn-light ms-2 profile-btn" aria-label="Profile" title="Profile">
                <span class="profile-initial">J</span>
              </button>
            </div>
          </nav>
        </div>
      </header>

      <main class="flex-fill container py-4">
        <router-outlet></router-outlet>
      </main>

      <app-toast-container></app-toast-container>

      <footer class="bg-dark text-white py-3 mt-auto">
        <div class="container text-center small">
          <p class="mb-0">&copy; 2025 Reval Code Validator</p>
        </div>
      </footer>
    </div>
  `,
})
export class ShellLayoutComponent {
  constructor(private themeService: ThemeService) {}

  get isDark() {
    return this.themeService.isDark();
  }

  toggleTheme() {
    this.themeService.toggleTheme();
  }
}