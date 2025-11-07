import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ValidationService } from '../../core/services/validation.service';
import { ToastService } from '../../core/services/toast.service';
import { ValidationIssue } from '../../core/interfaces/validation.interface';

@Component({
  selector: 'app-quality-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="row g-3 g-md-4">
      <div class="col-12">
        <div class="d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between mb-3 gap-2">
          <h4 class="mb-0">Quality Dashboard</h4>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-secondary" (click)="exportIssues()">
              <span class="d-none d-sm-inline">Export JSON</span>
              <span class="d-inline d-sm-none">Export</span>
            </button>
            <button class="btn btn-sm btn-outline-primary" (click)="clearFixed()">
              <span class="d-none d-sm-inline">Clear Fixed</span>
              <span class="d-inline d-sm-none">Clear</span>
            </button>
          </div>
        </div>
      </div>

      <div class="col-12">
        <div *ngIf="(validationService.lastValidation$ | async) as report; else empty" class="panel-card">
          <!-- Stats Cards -->
          <div class="row g-2 g-md-3 mb-3">
            <div class="col-4">
              <div class="card p-2 text-center">
                <div class="h3 mb-0 text-danger">{{ report.summary.errors }}</div>
                <div class="small text-muted">Errors</div>
              </div>
            </div>
            <div class="col-4">
              <div class="card p-2 text-center">
                <div class="h3 mb-0 text-warning">{{ report.summary.warnings }}</div>
                <div class="small text-muted">Warnings</div>
              </div>
            </div>
            <div class="col-4">
              <div class="card p-2 text-center">
                <div class="h3 mb-0 text-info">{{ report.summary.info }}</div>
                <div class="small text-muted">Info</div>
              </div>
            </div>
          </div>

          <!-- Metadata -->
          <div class="mb-3 pb-3 border-bottom d-flex flex-wrap gap-3 align-items-center small">
            <div class="text-muted">
              <strong>Language:</strong> {{ report.language }}
            </div>
            <div class="text-muted d-none d-md-inline">
              <strong>Timestamp:</strong> {{ report.timestamp }}
            </div>
            <div class="ms-auto text-muted">
              <strong>Total Issues:</strong> {{ report.issues.length }}
            </div>
          </div>

          <!-- No Issues State -->
          <div *ngIf="report.issues.length === 0" class="text-center text-muted py-5">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mb-3" style="opacity:0.5">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <div class="h5">No issues found!</div>
            <p class="small">Your code looks clean.</p>
          </div>

          <!-- Issues List -->
          <div *ngFor="let issue of report.issues; let i = index"
               class="mb-3 p-3 rounded shadow-sm"
               [ngStyle]="{
                 'background-color': issue.type === 'error' ? '#fee' : (issue.type === 'warning' ? '#fff3cd' : '#e7f3ff'),
                 'border-left': '4px solid ' + (issue.type === 'error' ? '#dc3545' : (issue.type === 'warning' ? '#ffc107' : '#0dcaf0'))
               }">

            <!-- Issue Header -->
            <div class="d-flex align-items-start justify-content-between mb-2 gap-3">
              <div class="d-flex align-items-center gap-2 flex-wrap">
                <span class="badge"
                      [ngStyle]="{
                        'background-color': issue.type === 'error' ? '#dc3545' : (issue.type === 'warning' ? '#ffc107' : '#0dcaf0'),
                        'color': issue.type === 'warning' ? '#000' : '#fff'
                      }">
                  {{ issue.type }}
                </span>
                <span class="small text-muted">
                  Line {{ issue.line }}<span *ngIf="issue.column">:{{ issue.column }}</span>
                </span>
              </div>
            </div>

            <!-- Issue Message -->
            <div class="fw-semibold mb-2" style="color:#212529">
              {{ issue.message }}
            </div>

            <!-- Rule ID -->
            <div class="small text-muted mb-3">
              <strong>Rule:</strong> <code class="bg-white px-2 py-1 rounded">{{ issue.ruleId || 'N/A' }}</code>
            </div>

            <!-- Suggestion Box -->
            <div class="alert alert-light mb-3 py-2 px-3 border">
              <div class="small">
                <strong>💡 Suggestion:</strong> {{ suggestFix(issue) }}
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="d-flex gap-2 flex-wrap">
              <button class="btn btn-sm btn-success"
                      (click)="applyQuickFix(issue)"
                      title="Apply automatic fix">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="me-1">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Apply Fix
              </button>
              <button class="btn btn-sm"
                      [ngClass]="isFixed(issue) ? 'btn-outline-secondary' : 'btn-outline-primary'"
                      (click)="toggleFixed(issue)"
                      [title]="isFixed(issue) ? 'Unmark as fixed' : 'Mark as fixed'">
                <span *ngIf="isFixed(issue)">✓ Fixed</span>
                <span *ngIf="!isFixed(issue)">Mark as Fixed</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <ng-template #empty>
        <div class="col-12">
          <div class="panel-card text-center py-5">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mb-3 text-muted" style="opacity:0.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <h5 class="text-muted mb-2">No Validation Data</h5>
            <p class="text-muted mb-0">
              Navigate to the <strong>Validate</strong> page and run a validation to see the quality dashboard.
            </p>
          </div>
        </div>
      </ng-template>
    </div>
  `
})
export class QualityDashboardComponent {
  fixedKey = 'qc.fixed.issues';
  fixedSet = new Set<string>();

  constructor(public validationService: ValidationService, private readonly toast: ToastService) {
    // load persisted fixed marks
    try {
      const raw = localStorage.getItem(this.fixedKey);
      if (raw) {
        for (const k of JSON.parse(raw)) this.fixedSet.add(k as string);
      }
    } catch (e) {
      console.warn('Failed to load fixed issues', e);
    }
  }

  private issueKey(issue: ValidationIssue) {
    return `${issue.type}:${issue.line}:${issue.column || 0}:${issue.ruleId || issue.message}`;
  }

  isFixed(issue: ValidationIssue) {
    return this.fixedSet.has(this.issueKey(issue));
  }

  toggleFixed(issue: ValidationIssue) {
    const k = this.issueKey(issue);
    if (this.fixedSet.has(k)) this.fixedSet.delete(k); else this.fixedSet.add(k);
    this.save();
  }

  clearFixed() {
    this.fixedSet.clear();
    localStorage.removeItem(this.fixedKey);
  }

  save() {
    localStorage.setItem(this.fixedKey, JSON.stringify(Array.from(this.fixedSet)));
  }

  suggestFix(issue: ValidationIssue) {
    const id = (issue.ruleId || '').toLowerCase();
    if (id.includes('css-duplicate') || id.includes('duplicate')) return 'Remove duplicate property or merge declarations.';
    if (id.includes('css-empty-rule')) return 'Remove the empty CSS rule or add declarations.';
    if (id.includes('attr-no-duplication')) return 'Remove duplicated attribute on the element.';
    if (issue.message?.toLowerCase().includes('does not appear to be html')) return 'Check file type or ensure HTML tags are present.';
    if (id.startsWith('ts-')) return 'Fix TypeScript error reported by compiler; inspect file lines for detail.';
    return 'Review the issue and apply the appropriate fix in the editor.';
  }

  applyQuickFix(issue: ValidationIssue) {
    // Try to call the editor API exposed by the Validate page to apply a quick-fix in-place.
    const api = (globalThis as any).__reval;

    console.log('Attempting to apply fix...', {
      apiExists: !!api,
      applyFixExists: api && typeof api.applyFix === 'function',
      applyQuickFixExists: api && typeof api.applyQuickFix === 'function'
    });

    if (api) {
      let fn: any = null;
      if (typeof api.applyFix === 'function') fn = api.applyFix;
      else if (typeof api.applyQuickFix === 'function') fn = api.applyQuickFix;
      if (fn) {
        this.toast.show({ body: 'Applying fix...', variant: 'info', timeout: 1500 });
        Promise.resolve(fn(issue)).then(() => {
          this.toast.show({
            body: `✓ Fix applied successfully! The issue has been resolved in the Validate page.`,
            variant: 'success',
            timeout: 3000
          });
          // Automatically mark as fixed after successful application
          setTimeout(() => {
            this.toggleFixed(issue);
          }, 500);
        }).catch((e: any) => {
          console.error('applyQuickFix error', e);
          this.toast.show({
            body: 'Failed to apply fix. Please try manually in the Validate page.',
            variant: 'danger',
            timeout: 3000
          });
        });
        return;
      } else {
        console.warn('API exists but no valid function found', api);
      }
    } else {
      console.warn('__reval API not found on globalThis');
    }

    // Fallback: copy suggested fix to clipboard.
    const suggestion = this.suggestFix(issue);
    if (navigator.clipboard) navigator.clipboard.writeText(suggestion).then(() => console.info('Suggestion copied')).catch(() => {});
    this.toast.show({
      body: 'Editor API not available. Please navigate to the Validate page first. Suggestion copied to clipboard.',
      variant: 'warning',
      timeout: 4000
    });
  }

  exportIssues() {
    this.validationService.lastValidation$.subscribe(rep => {
      if (!rep) { alert('No report to export'); return; }
      const payload = { report: rep, fixed: Array.from(this.fixedSet) };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'quality-report.json';
      a.click();
      URL.revokeObjectURL(url);
    }).unsubscribe();
  }
}
