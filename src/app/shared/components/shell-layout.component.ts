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
      <header class="app-header py-2 py-md-3">
        <div class="container-fluid px-3">
          <div class="d-flex align-items-center justify-content-between">
            <div class="d-flex align-items-center">
              <div class="brand me-2 me-md-3">
                <span class="brand-logo">RC</span>
                <div class="d-flex flex-column">
                  <div class="brand-title">Reval Code Validator</div>
                  <small class="brand-tag d-none d-sm-block">Validate · Compare · Report</small>
                </div>
              </div>
            </div>

            <!-- Mobile menu toggle -->
            <button class="btn btn-sm btn-outline-light d-md-none" (click)="mobileMenuOpen = !mobileMenuOpen" [attr.aria-expanded]="mobileMenuOpen" aria-label="Toggle navigation">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line *ngIf="!mobileMenuOpen" x1="3" y1="12" x2="21" y2="12"></line>
                <line *ngIf="!mobileMenuOpen" x1="3" y1="6" x2="21" y2="6"></line>
                <line *ngIf="!mobileMenuOpen" x1="3" y1="18" x2="21" y2="18"></line>
                <line *ngIf="mobileMenuOpen" x1="18" y1="6" x2="6" y2="18"></line>
                <line *ngIf="mobileMenuOpen" x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>

            <!-- Desktop navigation -->
            <nav class="app-nav d-none d-md-flex align-items-center">
              <a class="nav-link d-inline-block" routerLink="/validate" routerLinkActive="active">Validate</a>
              <a class="nav-link d-inline-block" routerLink="/compare-css" routerLinkActive="active">Compare</a>
              <a class="nav-link d-inline-block" routerLink="/report" routerLinkActive="active">Report</a>
              <a class="nav-link d-inline-block" routerLink="/quality" routerLinkActive="active">Quality</a>

              <div class="nav-actions ms-3">
                <button (click)="toggleTheme()" class="btn btn-sm btn-outline-light" [attr.aria-label]="'Toggle ' + (isDark ? 'light' : 'dark') + ' mode'">
                  <svg *ngIf="!isDark" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"></path></svg>
                  <svg *ngIf="isDark" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path></svg>
                  <span class="d-none d-lg-inline ms-1">{{ isDark ? 'Light' : 'Dark' }}</span>
                </button>

                <button class="btn btn-sm btn-light ms-2 profile-btn" aria-label="Profile" title="Profile">
                  <span class="profile-initial">J</span>
                </button>
              </div>
            </nav>
          </div>

          <!-- Mobile navigation menu (collapsible) -->
          <nav *ngIf="mobileMenuOpen" class="app-nav-mobile d-md-none mt-3 pb-2">
            <a class="nav-link d-block mb-2" routerLink="/validate" routerLinkActive="active" (click)="mobileMenuOpen = false">Validate</a>
            <a class="nav-link d-block mb-2" routerLink="/compare-css" routerLinkActive="active" (click)="mobileMenuOpen = false">Compare Files</a>
            <a class="nav-link d-block mb-2" routerLink="/report" routerLinkActive="active" (click)="mobileMenuOpen = false">Report</a>
            <a class="nav-link d-block mb-2" routerLink="/quality" routerLinkActive="active" (click)="mobileMenuOpen = false">Quality</a>

            <div class="d-flex gap-2 mt-3">
              <button (click)="toggleTheme()" class="btn btn-sm btn-outline-light flex-fill">
                <svg *ngIf="!isDark" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="me-1"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"></path></svg>
                <svg *ngIf="isDark" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="me-1"><circle cx="12" cy="12" r="3"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path></svg>
                {{ isDark ? 'Light Mode' : 'Dark Mode' }}
              </button>
              <button class="btn btn-sm btn-light profile-btn" aria-label="Profile" title="Profile">
                <span class="profile-initial">J</span>
              </button>
            </div>
          </nav>
        </div>
      </header>

      <main class="flex-fill container-fluid px-3 py-3 py-md-4">
        <router-outlet></router-outlet>
      </main>

      <app-toast-container></app-toast-container>

      <footer class="bg-dark text-white py-2 py-md-3 mt-auto">
        <div class="container text-center small">
          <p class="mb-0">&copy; 2025 Reval Code Validator</p>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    .brand-title {
      font-size: 1rem;
    }

    @media (max-width: 576px) {
      .brand-title {
        font-size: 0.85rem;
      }
    }

    .app-nav-mobile {
      animation: slideDown 0.2s ease-out;
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .app-nav-mobile .nav-link {
      background: rgba(255,255,255,0.05);
      border-radius: 0.375rem;
      padding: 0.625rem 0.75rem;
      transition: background 0.15s ease;
    }

    .app-nav-mobile .nav-link:hover,
    .app-nav-mobile .nav-link.active {
      background: rgba(255,255,255,0.15);
    }
  `]
})
export class ShellLayoutComponent {
  mobileMenuOpen = false;

  constructor(private themeService: ThemeService) {}

  get isDark() {
    return this.themeService.isDark();
  }

  toggleTheme() {
    this.themeService.toggleTheme();
  }
}