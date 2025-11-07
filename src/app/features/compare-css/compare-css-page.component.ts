import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { CssDiffService, CodeDuplicate } from '../../core/services/css-diff.service';
import { CssDuplicate } from '../../core/interfaces/validation.interface';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-compare-css-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MonacoEditorModule],
  template: `
    <div class="container-fluid px-0">
      <div class="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-3 gap-2">
        <div class="d-flex flex-wrap gap-2 align-items-center">
          <label class="small text-muted mb-0 d-none d-sm-inline">Compare</label>
          <select [(ngModel)]="selectedLanguage" (change)="onLanguageChange()" class="form-select form-select-sm" style="width:auto;">
            <option value="css">CSS</option>
            <option value="html">HTML</option>
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
          </select>

          <input type="file" (change)="onLeftFileSelected($event)" class="d-none" #leftFileInput />
          <input type="file" (change)="onRightFileSelected($event)" class="d-none" #rightFileInput />
          <button class="btn btn-outline-primary btn-sm" style="white-space:nowrap;min-width:90px" (click)="leftFileInput.click()">
            <span class="d-none d-sm-inline">Load Left</span>
            <span class="d-inline d-sm-none">Left</span>
          </button>
          <button class="btn btn-outline-primary btn-sm" style="white-space:nowrap;min-width:90px" (click)="rightFileInput.click()">
            <span class="d-none d-sm-inline">Load Right</span>
            <span class="d-inline d-sm-none">Right</span>
          </button>
        </div>
        <button class="btn btn-primary-app btn-sm" (click)="compare()" [disabled]="!leftText || !rightText">Compare</button>
      </div>

      <div class="row g-2 g-md-3 pb-4">
        <div class="col-12 col-lg-6" style="height:40vh;">
          <div class="panel-card h-100">
            <div class="small text-muted mb-2 d-lg-none">Left File</div>
            <ngx-monaco-editor [options]="editorOptions" [(ngModel)]="leftText"></ngx-monaco-editor>
          </div>
        </div>
        <div class="col-12 col-lg-6" style="height:40vh;">
          <div class="panel-card h-100">
            <div class="small text-muted mb-2 d-lg-none">Right File</div>
            <ngx-monaco-editor [options]="editorOptions" [(ngModel)]="rightText"></ngx-monaco-editor>
          </div>
        </div>
      </div>

      <!-- CSS duplicate view -->
      <div *ngIf="selectedLanguage === 'css' && duplicates && duplicates.length > 0" class="mt-3 panel-card">
        <div class="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center mb-2 gap-2">
          <h5 class="mb-0">Duplicate Selectors</h5>
          <div class="small text-muted">Found {{ duplicates.length }} duplicate{{ duplicates.length === 1 ? '' : 's' }} ({{ conflictCount }} conflict{{ conflictCount === 1 ? '' : 's' }})</div>
        </div>

        <div *ngFor="let duplicate of duplicates; trackBy: trackBySelector" class="mb-2 p-2 rounded" [ngClass]="{ 'border border-danger': duplicate.hasConflict }">
          <div class="d-flex flex-column flex-sm-row justify-content-between align-items-start gap-2">
            <h6 class="mb-1">{{ duplicate.selector }}</h6>
            <span class="badge" [ngClass]="duplicate.hasConflict ? 'bg-danger' : 'bg-success'">{{ duplicate.hasConflict ? 'Conflict' : 'Identical' }}</span>
          </div>
          <div class="row mt-2 g-2">
            <div class="col-12 col-md-6">
              <h6 class="small">Left CSS</h6>
              <pre class="small bg-light p-2 rounded mb-0" style="overflow-x:auto;">{{ duplicate.declarationsA.join('\n') }}</pre>
            </div>
            <div class="col-12 col-md-6">
              <h6 class="small">Right CSS</h6>
              <pre class="small bg-light p-2 rounded mb-0" style="overflow-x:auto;">{{ duplicate.declarationsB.join('\n') }}</pre>
            </div>
          </div>
        </div>
      </div>

      <!-- Code duplicate view for HTML/JS/TS -->
      <div *ngIf="selectedLanguage !== 'css' && codeDuplicates && codeDuplicates.length > 0" class="mt-3 panel-card">
        <div class="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center mb-2 gap-2">
          <h5 class="mb-0">Duplicate {{ selectedLanguage === 'html' ? 'IDs' : (selectedLanguage === 'typescript' ? 'Classes/Functions' : 'Functions/Variables') }}</h5>
          <div class="small text-muted">Found {{ codeDuplicates.length }} duplicate{{ codeDuplicates.length === 1 ? '' : 's' }} ({{ conflictCount }} conflict{{ conflictCount === 1 ? '' : 's' }})</div>
        </div>

        <div *ngFor="let duplicate of codeDuplicates; let i = index" class="mb-2 p-2 rounded" [ngClass]="{ 'border border-danger': duplicate.hasConflict }">
          <div class="d-flex flex-column flex-sm-row justify-content-between align-items-start gap-2">
            <h6 class="mb-1">
              <span class="badge bg-secondary me-2">{{ duplicate.type }}</span>
              {{ duplicate.name }}
            </h6>
            <span class="badge" [ngClass]="duplicate.hasConflict ? 'bg-danger' : 'bg-success'">{{ duplicate.hasConflict ? 'Different' : 'Identical' }}</span>
          </div>
          <div class="row mt-2 g-2">
            <div class="col-12 col-md-6">
              <h6 class="small">Left File</h6>
              <pre class="small bg-light p-2 rounded mb-0" style="max-height:200px;overflow:auto;font-size:0.75rem;">{{ duplicate.leftCode }}</pre>
            </div>
            <div class="col-12 col-md-6">
              <h6 class="small">Right File</h6>
              <pre class="small bg-light p-2 rounded mb-0" style="max-height:200px;overflow:auto;font-size:0.75rem;">{{ duplicate.rightCode }}</pre>
            </div>
          </div>
        </div>
      </div>

      <!-- Text diff view for HTML/JS/TS (when no duplicates found) -->
      <div *ngIf="selectedLanguage !== 'css' && textDiff?.length" class="mt-3 panel-card">
        <h5 class="mb-2">Text Diff</h5>
        <div class="small text-muted mb-2">Showing semantic diff (left → right)</div>
        <div class="diff-output" style="font-family:monospace;white-space:pre-wrap;word-break:break-word;font-size:0.8rem;overflow-x:auto;">
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
  leftFileName = '';
  rightFileName = '';
  duplicates: CssDuplicate[] = [];
  codeDuplicates: CodeDuplicate[] = [];
  textDiff: any[] = [];
  editorOptions = {
    theme: 'vs-dark',
    language: 'css',
    minimap: { enabled: false },
    readOnly: false
  };

  constructor(
    private readonly cssDiffService: CssDiffService,
    private readonly toast: ToastService
  ) {}

  get conflictCount(): number {
    if (this.selectedLanguage === 'css') {
      return this.duplicates ? this.duplicates.filter(d => d.hasConflict).length : 0;
    }
    return this.codeDuplicates ? this.codeDuplicates.filter(d => d.hasConflict).length : 0;
  }

  trackBySelector(index: number, item: CssDuplicate) {
    return item.selector || index;
  }

  async onLeftFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    // Get file extension
    const ext = file.name.split('.').pop()?.toLowerCase();

    // Validate file type matches selected language
    const isValidFileType = this.validateFileType(ext || '', this.selectedLanguage);
    if (!isValidFileType) {
      this.toast.show({
        body: `File type mismatch! Selected language is "${this.selectedLanguage}" but uploaded file is ".${ext}". Please select the correct language or upload a matching file.`,
        variant: 'danger',
        timeout: 5000
      });
      // Reset file input
      (event.target as HTMLInputElement).value = '';
      return;
    }

    // If right file already loaded, check if they match
    if (this.rightFileName) {
      const rightExt = this.rightFileName.split('.').pop()?.toLowerCase();
      if (ext !== rightExt) {
        this.toast.show({
          body: `File types must match! Right file is ".${rightExt}" but left file is ".${ext}". Please upload matching file types.`,
          variant: 'danger',
          timeout: 5000
        });
        // Reset file input
        (event.target as HTMLInputElement).value = '';
        return;
      }
    }

    try {
      this.leftText = await file.text();
      this.leftFileName = file.name;
      this.maybeDetectLanguageFromFilename(file.name);
    } catch (error) {
      console.error('Error reading left file:', error);
      this.toast.show({
        body: 'Error reading file. Please try again.',
        variant: 'danger',
        timeout: 3000
      });
    }
  }

  async onRightFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    // Get file extension
    const ext = file.name.split('.').pop()?.toLowerCase();

    // Validate file type matches selected language
    const isValidFileType = this.validateFileType(ext || '', this.selectedLanguage);
    if (!isValidFileType) {
      this.toast.show({
        body: `File type mismatch! Selected language is "${this.selectedLanguage}" but uploaded file is ".${ext}". Please select the correct language or upload a matching file.`,
        variant: 'danger',
        timeout: 5000
      });
      // Reset file input
      (event.target as HTMLInputElement).value = '';
      return;
    }

    // If left file already loaded, check if they match
    if (this.leftFileName) {
      const leftExt = this.leftFileName.split('.').pop()?.toLowerCase();
      if (ext !== leftExt) {
        this.toast.show({
          body: `File types must match! Left file is ".${leftExt}" but right file is ".${ext}". Please upload matching file types.`,
          variant: 'danger',
          timeout: 5000
        });
        // Reset file input
        (event.target as HTMLInputElement).value = '';
        return;
      }
    }

    try {
      this.rightText = await file.text();
      this.rightFileName = file.name;
      this.maybeDetectLanguageFromFilename(file.name);
    } catch (error) {
      console.error('Error reading right file:', error);
      this.toast.show({
        body: 'Error reading file. Please try again.',
        variant: 'danger',
        timeout: 3000
      });
    }
  }

  onLanguageChange() {
    this.editorOptions = { ...this.editorOptions, language: this.selectedLanguage };
    // clear previous results
    this.duplicates = [];
    this.codeDuplicates = [];
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

  private validateFileType(fileExtension: string, selectedLanguage: string): boolean {
    const extensionMap: { [key: string]: string[] } = {
      'css': ['css'],
      'html': ['html', 'htm'],
      'javascript': ['js'],
      'typescript': ['ts']
    };

    const validExtensions = extensionMap[selectedLanguage] || [];
    return validExtensions.includes(fileExtension);
  }

  async compare() {
    if (!this.leftText || !this.rightText) return;
    try {
      if (this.selectedLanguage === 'css') {
        this.duplicates = await this.cssDiffService.findDuplicateSelectors(this.leftText, this.rightText);
        this.codeDuplicates = [];
        this.textDiff = [];
      } else if (this.selectedLanguage === 'html') {
        this.codeDuplicates = this.cssDiffService.findHtmlDuplicates(this.leftText, this.rightText);
        this.duplicates = [];
        this.textDiff = this.codeDuplicates.length === 0 ? this.cssDiffService.diffText(this.leftText, this.rightText) || [] : [];
      } else if (this.selectedLanguage === 'javascript') {
        this.codeDuplicates = this.cssDiffService.findJsDuplicates(this.leftText, this.rightText);
        this.duplicates = [];
        this.textDiff = this.codeDuplicates.length === 0 ? this.cssDiffService.diffText(this.leftText, this.rightText) || [] : [];
      } else if (this.selectedLanguage === 'typescript') {
        this.codeDuplicates = this.cssDiffService.findTsDuplicates(this.leftText, this.rightText);
        this.duplicates = [];
        this.textDiff = this.codeDuplicates.length === 0 ? this.cssDiffService.diffText(this.leftText, this.rightText) || [] : [];
      } else {
        this.textDiff = this.cssDiffService.diffText(this.leftText, this.rightText) || [];
        this.duplicates = [];
        this.codeDuplicates = [];
      }
    } catch (error) {
      console.error('Error comparing files:', error);
      this.toast.show({
        body: 'Error comparing files. Please check the syntax and try again.',
        variant: 'danger',
        timeout: 4000
      });
    }
  }
}