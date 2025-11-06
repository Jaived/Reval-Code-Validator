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
    <div class="row g-4">
      <div class="col-12">
        <div class="d-flex align-items-center justify-content-between mb-3">
          <h4 class="mb-0">Quality Dashboard</h4>
          <div>
            <button class="btn btn-sm btn-outline-secondary me-2" (click)="exportIssues()">Export JSON</button>
            <button class="btn btn-sm btn-outline-primary" (click)="clearFixed()">Clear Fixed Marks</button>
          </div>
        </div>
      </div>

      <div class="col-12">
        <div *ngIf="(validationService.lastValidation$ | async) as report; else empty" class="panel-card">
          <div class="row g-3">
            <div class="col-4">
              <div class="card p-2 text-center">
                <div class="h2 text-danger mb-0">{{ report.summary.errors }}</div>
                <div class="small text-muted">Errors</div>
              </div>
            </div>
            <div class="col-4">
              <div class="card p-2 text-center">
                <div class="h2 text-warning mb-0">{{ report.summary.warnings }}</div>
                <div class="small text-muted">Warnings</div>
              </div>
            </div>
            <div class="col-4">
              <div class="card p-2 text-center">
                <div class="h2 text-info mb-0">{{ report.summary.info }}</div>
                <div class="small text-muted">Info</div>
              </div>
            </div>
          </div>

          <hr />

          <div class="mb-3 d-flex gap-2 align-items-center">
            <div class="small text-muted">Language: <strong>{{ report.language }}</strong></div>
            <div class="small text-muted">Timestamp: <strong>{{ report.timestamp }}</strong></div>
            <div class="ms-auto small text-muted">Issues: <strong>{{ report.issues.length }}</strong></div>
          </div>

          <div *ngIf="report.issues?.length === 0" class="text-center text-muted py-3">No issues reported.</div>

          <div *ngFor="let issue of report.issues; let i = index" class="mb-2 p-2 rounded" [ngClass]="{
              'border border-danger bg-light': issue.type === 'error',
              'border border-warning bg-light': issue.type === 'warning',
              'border border-info bg-light': issue.type === 'info'
            }">
            <div class="d-flex align-items-start">
              <div style="min-width:0;flex:1">
                <div class="d-flex align-items-center justify-content-between">
                  <div class="fw-semibold text-truncate">{{ issue.message }}</div>
                  <div class="small text-muted">Line {{ issue.line }}<span *ngIf="issue.column">:{{ issue.column }}</span></div>
                </div>
                <div class="small text-muted">Rule: {{ issue.ruleId || '—' }}</div>
                <div class="mt-2">
                  <div class="small"><strong>Suggestion:</strong> {{ suggestFix(issue) }}</div>
                </div>
              </div>

              <div class="ms-3 text-end">
                <button class="btn btn-sm btn-outline-success mb-1 me-2" (click)="applyQuickFix(issue)">Apply Quick Fix</button>
                <button class="btn btn-sm btn-outline-secondary mb-1" (click)="toggleFixed(issue)">{{ isFixed(issue) ? 'Unmark' : 'Mark Fixed' }}</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ng-template #empty>
        <div class="panel-card text-center text-muted">No validation run yet. Open Validate page and run a validation to populate the dashboard.</div>
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
    if (api) {
  let fn: any = null;
  if (typeof api.applyFix === 'function') fn = api.applyFix;
  else if (typeof api.applyQuickFix === 'function') fn = api.applyQuickFix;
  if (fn) {
        Promise.resolve(fn(issue)).then(() => {
          this.toast.show({ body: 'Applied quick fix to the editor (if available).', variant: 'success', timeout: 2000 });
        }).catch((e: any) => {
          console.warn('applyQuickFix error', e);
          this.toast.show({ body: 'Quick fix failed to apply in editor.', variant: 'danger', timeout: 3000 });
        });
        return;
      }
    }

    // Fallback: copy suggested fix to clipboard.
    const suggestion = this.suggestFix(issue);
    if (navigator.clipboard) navigator.clipboard.writeText(suggestion).then(() => console.info('Suggestion copied')).catch(() => {});
    this.toast.show({ body: 'Quick fix suggestion copied to clipboard.', variant: 'info', timeout: 3000 });
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
