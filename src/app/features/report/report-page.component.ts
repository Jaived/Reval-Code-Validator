import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ValidationService } from '../../core/services/validation.service';
import { CssDiffService } from '../../core/services/css-diff.service';
import { ReportService } from '../../core/services/report.service';
import { ValidationReport } from '../../core/interfaces/validation.interface';

@Component({
  selector: 'app-report-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div #reportContainer>
      <div class="row g-3 mb-3">
        <div class="col-12 col-md-4">
          <div class="panel-card text-center">
            <h6 class="mb-1">Errors</h6>
            <div class="display-6 text-danger">{{ report?.summary?.errors || 0 }}</div>
          </div>
        </div>
        <div class="col-12 col-md-4">
          <div class="panel-card text-center">
            <h6 class="mb-1">Warnings</h6>
            <div class="display-6 text-warning">{{ report?.summary?.warnings || 0 }}</div>
          </div>
        </div>
        <div class="col-12 col-md-4">
          <div class="panel-card text-center">
            <h6 class="mb-1">Info</h6>
            <div class="display-6 text-info">{{ report?.summary?.info || 0 }}</div>
          </div>
        </div>
      </div>

      <div class="d-flex justify-content-end mb-3">
        <button (click)="exportJson()" class="btn btn-outline-primary btn-sm me-2">Export JSON</button>
        <button (click)="exportPdf()" class="btn btn-primary-app btn-sm">Export PDF</button>
      </div>

      <ng-container *ngIf="report; else noReport">
        <div class="panel-card">
          <div class="mb-3">
            <h5 class="mb-0">Last Validation Report</h5>
            <small class="text-muted">{{ report.language | uppercase }} · {{ report.timestamp | date:'medium' }}</small>
          </div>

          <div *ngIf="report.issues?.length === 0" class="text-center text-muted py-4">No issues found in the last run.</div>

          <div *ngFor="let issue of report.issues; trackBy: trackByIssue" class="mb-2 p-2 rounded" [ngClass]="{ 'border border-danger': issue.type === 'error' }">
            <div class="d-flex justify-content-between">
              <div>
                <div class="fw-semibold">Line {{ issue.line }}</div>
                <div class="small text-muted">{{ issue.message }}</div>
                <div *ngIf="issue.ruleId" class="small text-muted">Rule: {{ issue.ruleId }}</div>
              </div>
              <div>
                <span class="badge bg-secondary">{{ issue.type }}</span>
              </div>
            </div>
          </div>
        </div>
      </ng-container>

      <ng-template #noReport>
        <div class="text-center py-5 panel-card">
          <p class="h6 text-muted">No validation report available.</p>
          <p class="small text-muted">Run a validation or CSS comparison to generate a report.</p>
        </div>
      </ng-template>
    </div>
  `
})
export class ReportPageComponent {
  @ViewChild('reportContainer') reportContainer!: ElementRef;
  report: ValidationReport | null = null;

  constructor(
    private validationService: ValidationService,
    private cssDiffService: CssDiffService,
    private reportService: ReportService
  ) {
    this.validationService.lastValidation$.subscribe(report => {
      this.report = report;
    });
  }

  async exportPdf() {
    if (!this.reportContainer) return;

    try {
      await this.reportService.exportPdf(this.reportContainer.nativeElement);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  }

  exportJson() {
    if (!this.report) return;

    try {
      this.reportService.exportJson(this.report);
    } catch (error) {
      console.error('Error exporting JSON:', error);
      alert('Error exporting JSON. Please try again.');
    }
  }

  trackByIssue(index: number, item: any) {
    return item?.line ?? index;
  }
}