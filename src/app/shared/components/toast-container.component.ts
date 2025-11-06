import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div aria-live="polite" aria-atomic="true" style="position: fixed; top: 1rem; right: 1rem; z-index: 1080;">
      <ng-container *ngFor="let t of toastService.messages$ | async">
        <div class="toast show mb-2" role="alert" aria-live="assertive" aria-atomic="true">
          <div class="toast-header">
            <strong class="me-auto">{{ t.title || 'Notice' }}</strong>
            <small class="text-muted">now</small>
            <button type="button" class="btn-close ms-2 mb-1" aria-label="Close" (click)="toastService.dismiss(t.id)"></button>
          </div>
          <div class="toast-body">{{ t.body }}</div>
        </div>
      </ng-container>
    </div>
  `
})

export class ToastContainerComponent {
  constructor(public toastService: ToastService) {}
}