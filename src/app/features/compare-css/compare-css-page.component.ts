import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { CssDiffService } from '../../core/services/css-diff.service';
import { CssDuplicate } from '../../core/interfaces/validation.interface';

@Component({
  selector: 'app-compare-css-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MonacoEditorModule],
  template: `
    <div class="container">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div class="d-flex gap-2 align-items-center flex-nowrap">
          <label class="small text-muted mb-0">Compare</label>
          <select [(ngModel)]="selectedLanguage" (change)="onLanguageChange()" class="form-select form-select-sm w-auto">
            <option value="css">CSS</option>
            <option value="html">HTML</option>
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
          </select>

          <input type="file" (change)="onLeftFileSelected($event)" class="d-none" #leftFileInput />
          <input type="file" (change)="onRightFileSelected($event)" class="d-none" #rightFileInput />
          <button class="btn btn-outline-primary btn-sm" style="white-space:nowrap;min-width:110px" (click)="leftFileInput.click()">Load Left</button>
          <button class="btn btn-outline-primary btn-sm" style="white-space:nowrap;min-width:110px" (click)="rightFileInput.click()">Load Right</button>
        </div>
        <button class="btn btn-primary-app btn-sm" (click)="compare()" [disabled]="!leftText || !rightText">Compare</button>
      </div>

      <div class="row g-3">
        <div class="col-12 col-lg-6" style="height:40vh;">
          <div class="panel-card h-100">
            <ngx-monaco-editor [options]="editorOptions" [(ngModel)]="leftText"></ngx-monaco-editor>
          </div>
        </div>
        <div class="col-12 col-lg-6" style="height:40vh;">
          <div class="panel-card h-100">
            <ngx-monaco-editor [options]="editorOptions" [(ngModel)]="rightText"></ngx-monaco-editor>
          </div>
        </div>
      </div>

      <!-- CSS duplicate view -->
      <div *ngIf="selectedLanguage === 'css' && duplicates && duplicates.length > 0" class="mt-3 panel-card">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h5 class="mb-0">Duplicate Selectors</h5>
          <div class="small text-muted">Found {{ duplicates.length }} duplicate{{ duplicates.length === 1 ? '' : 's' }} ({{ conflictCount }} with conflicts)</div>
        </div>

        <div *ngFor="let duplicate of duplicates; trackBy: trackBySelector" class="mb-2 p-2 rounded" [ngClass]="{ 'border border-danger': duplicate.hasConflict }">
          <div class="d-flex justify-content-between align-items-start">
            <h6 class="mb-1">{{ duplicate.selector }}</h6>
            <span class="badge" [ngClass]="duplicate.hasConflict ? 'bg-danger' : 'bg-success'">{{ duplicate.hasConflict ? 'Conflict' : 'Identical' }}</span>
          </div>
          <div class="row mt-2">
            <div class="col-6">
              <h6 class="small">Left CSS</h6>
              <pre class="small bg-light p-2 rounded">{{ duplicate.declarationsA.join('\n') }}</pre>
            </div>
            <div class="col-6">
              <h6 class="small">Right CSS</h6>
              <pre class="small bg-light p-2 rounded">{{ duplicate.declarationsB.join('\n') }}</pre>
            </div>
          </div>
        </div>
      </div>

      <!-- Text diff view for HTML/JS/TS -->
      <div *ngIf="selectedLanguage !== 'css' && textDiff?.length" class="mt-3 panel-card">
        <h5 class="mb-2">Text Diff</h5>
        <div class="small text-muted mb-2">Showing semantic diff (left → right)</div>
        <div class="diff-output" style="font-family:monospace;white-space:pre-wrap;word-break:break-word;">
          <ng-container *ngFor="let part of textDiff">
            <span [ngClass]="{'bg-success text-white p-1 rounded': part[0] === 1, 'bg-danger text-white p-1 rounded': part[0] === -1, '': part[0] === 0}">{{ part[1] }}</span>
          </ng-container>
        </div>
      </div>
    </div>
  `
})
export class CompareCssPageComponent {
  selectedLanguage: 'css' | 'html' | 'javascript' | 'typescript' = 'css';
  leftText = '';
  rightText = '';
  duplicates: CssDuplicate[] = [];
  textDiff: any[] = [];
  editorOptions = {
    theme: 'vs-dark',
    language: 'css',
    minimap: { enabled: false },
    readOnly: false
  };

  constructor(private readonly cssDiffService: CssDiffService) {}

  get conflictCount(): number {
    return this.duplicates ? this.duplicates.filter(d => d.hasConflict).length : 0;
  }

  trackBySelector(index: number, item: CssDuplicate) {
    return item.selector || index;
  }

  async onLeftFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      this.leftText = await file.text();
      this.maybeDetectLanguageFromFilename(file.name);
    } catch (error) {
      console.error('Error reading left file:', error);
      alert('Error reading file. Please try again.');
    }
  }

  async onRightFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      this.rightText = await file.text();
      this.maybeDetectLanguageFromFilename(file.name);
    } catch (error) {
      console.error('Error reading right file:', error);
      alert('Error reading file. Please try again.');
    }
  }

  onLanguageChange() {
    this.editorOptions = { ...this.editorOptions, language: this.selectedLanguage };
    // clear previous results
    this.duplicates = [];
    this.textDiff = [];
  }

  maybeDetectLanguageFromFilename(name: string) {
    const ext = name.split('.').pop()?.toLowerCase();
    if (!ext) return;
    const map: Record<string, 'css'|'html'|'javascript'|'typescript'> = {
      'css': 'css', 'html': 'html', 'htm': 'html', 'js': 'javascript', 'ts': 'typescript'
    };
    const detected = map[ext];
    if (detected) {
      this.selectedLanguage = detected;
      this.onLanguageChange();
    }
  }

  async compare() {
    if (!this.leftText || !this.rightText) return;
    try {
      if (this.selectedLanguage === 'css') {
        this.duplicates = await this.cssDiffService.findDuplicateSelectors(this.leftText, this.rightText);
        this.textDiff = [];
      } else {
        this.textDiff = this.cssDiffService.diffText(this.leftText, this.rightText) || [];
        this.duplicates = [];
      }
    } catch (error) {
      console.error('Error comparing files:', error);
      alert('Error comparing files. Please check the syntax and try again.');
    }
  }
}