import { Component, Inject, OnInit, OnDestroy, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { ValidationService } from '../../core/services/validation.service';
import { ValidationIssue } from '../../core/interfaces/validation.interface';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-validate-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MonacoEditorModule],
  template: `
    <div class="row g-4">
      <div class="col-12 mb-3">
        <div class="d-flex align-items-center justify-content-between">
          <div class="d-flex align-items-center gap-3">
            <div>
              <select [(ngModel)]="selectedLanguage" class="form-select form-select-sm">
                <option value="html">HTML</option>
                <option value="css">CSS</option>
                <option value="typescript">TypeScript</option>
                <option value="javascript">JavaScript</option>
              </select>
            </div>
            <div>
              <input type="file" (change)="onFileSelected($event)" class="d-none" #fileInput />
              <button (click)="fileInput.click()" class="btn btn-outline-primary btn-sm">Load File</button>
            </div>
            <div>
              <button (click)="validate()" class="btn btn-primary-app btn-sm">Validate</button>
            </div>
            <div *ngIf="fileName" class="ms-3 text-truncate" style="max-width:360px">
              <small class="text-muted">Loaded:</small>
              <div class="fw-medium">{{ fileName }} <span class="text-muted small">• {{ fileSizeStr }}</span></div>
            </div>
          </div>

          <div class="d-flex align-items-center gap-2">
            <button class="btn btn-sm btn-outline-secondary" (click)="copyCode()">Copy Code</button>
            <button class="btn btn-sm btn-outline-secondary" (click)="downloadReport()">Download Report</button>
            <button class="btn btn-sm btn-outline-danger" title="Clear saved code / validation data" (click)="clearData()">Clear Data</button>
          </div>
        </div>
      </div>

      <div class="col-12 col-lg-8" style="height: 68vh;">
        <div class="panel-card h-100">
          <ngx-monaco-editor [options]="editorOptions" [(ngModel)]="code" (ngModelChange)="onCodeChange()"></ngx-monaco-editor>
        </div>
      </div>

      <div class="col-12 col-lg-4">
        <div class="panel-card results-panel h-100 d-flex flex-column">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h5 class="mb-0">Validation</h5>
            <div class="btn-group btn-group-sm" role="group">
              <button type="button" class="btn btn-outline-secondary" [class.active]="filterType==='all'" (click)="filterType = 'all'">All</button>
              <button type="button" class="btn btn-outline-danger" [class.active]="filterType==='error'" (click)="filterType = 'error'">Errors</button>
              <button type="button" class="btn btn-outline-warning" [class.active]="filterType==='warning'" (click)="filterType = 'warning'">Warnings</button>
            </div>
          </div>

          <div class="mb-3">
            <div class="row g-2">
              <div class="col-4">
                <div class="card text-center p-2">
                  <div class="h3 mb-0 text-danger">{{ errorCount }}</div>
                  <div class="small text-muted">Errors</div>
                </div>
              </div>
              <div class="col-4">
                <div class="card text-center p-2">
                  <div class="h3 mb-0 text-warning">{{ warningCount }}</div>
                  <div class="small text-muted">Warnings</div>
                </div>
              </div>
              <div class="col-4">
                <div class="card text-center p-2">
                  <div class="h3 mb-0 text-info">{{ infoCount }}</div>
                  <div class="small text-muted">Info</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Preview -->
          <div class="mb-3">
            <div class="small text-muted mb-1">Preview</div>
            <div class="preview-box p-2 rounded bg-white text-dark" style="max-height:140px;overflow:auto;white-space:pre-wrap;word-break:break-word;border:1px solid #e9ecef">{{ code || '(no file loaded)' }}</div>
          </div>

          <div class="flex-grow-1 overflow-auto">
            <div *ngIf="filteredIssues.length === 0" class="text-center text-muted-small py-4">No issues found.</div>

            <div *ngFor="let issue of filteredIssues; trackBy: trackByIssue" class="mb-2 p-2 rounded" [ngClass]="{
                  'border border-danger bg-light': issue.type === 'error',
                  'border border-warning bg-light': issue.type === 'warning',
                  'border border-info bg-light': issue.type === 'info'
                }">
              <div class="d-flex justify-content-between">
                <div style="min-width:0">
                  <div class="fw-semibold text-truncate">{{ issue.message }}</div>
                  <div class="small text-muted">Line {{ issue.line }}<span *ngIf="issue.column">:{{ issue.column }}</span> <span *ngIf="issue.ruleId">• {{ issue.ruleId }}</span></div>
                  <div class="mt-2 small"><code class="bg-white p-1 rounded" style="white-space:pre-wrap;display:block">{{ getContext(issue.line) }}</code></div>
                  <div *ngIf="issue.suggestion" class="mt-2 small text-success">Suggestion: {{ issue.suggestion }}</div>
                </div>
                <div class="ms-2 text-end">
                  <span class="badge bg-secondary text-capitalize">{{ issue.type }}</span>
                  <div class="mt-2">
                    <button class="btn btn-sm btn-outline-secondary" (click)="revealLine(issue.line)">Go</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ValidatePageComponent implements OnInit, OnDestroy {
  code = '';
  selectedLanguage = 'html';
  issues: ValidationIssue[] = [];
  filterType: 'all' | 'error' | 'warning' = 'all';
  editorOptions = {
    theme: 'vs-dark',
    language: 'html',
    minimap: { enabled: false }
  };

  // metadata for loaded file
  fileName = '';
  fileSize = 0;

  get fileSizeStr() {
    return this.formatBytes(this.fileSize);
  }

  get errorCount() {
    return this.issues.filter(i => i.type === 'error').length;
  }

  get warningCount() {
    return this.issues.filter(i => i.type === 'warning').length;
  }

  get infoCount() {
    return this.issues.filter(i => i.type === 'info').length;
  }

  constructor(public validationService: ValidationService,@Inject(PLATFORM_ID) public platformId: Object, private readonly toast: ToastService) {}

  private setMonacoMarkers(issues: ValidationIssue[]) {
    const monaco = (globalThis as any).monaco;
    if (!monaco) return;
    const editor = monaco.editor.getEditors?.()?.[0];
    const model = editor?.getModel?.();
    if (!model) return;

    const markers: any[] = issues.map(i => {
      const startLine = i.range?.startLine || i.line || 1;
      const startCol = i.range?.startColumn || i.column || 1;
      const endLine = i.range?.endLine || i.line || startLine;
      const endCol = i.range?.endColumn || i.column || startCol;
      let severity = monaco.MarkerSeverity.Info;
      if (i.type === 'error') severity = monaco.MarkerSeverity.Error;
      else if (i.type === 'warning') severity = monaco.MarkerSeverity.Warning;
      return {
        severity,
        message: i.message,
        startLineNumber: startLine,
        startColumn: startCol,
        endLineNumber: endLine,
        endColumn: endCol,
        source: i.ruleId || 'reval'
      };
    });

    try {
      monaco.editor.setModelMarkers(model, 'reval', markers);
    } catch (e) {
      console.debug('setMonacoMarkers failed', e);
    }
  }

  async applyFix(issue: ValidationIssue) {
    if (!issue.fix) {
      // fallback to existing heuristic
      await this.applyQuickFixFromDashboard(issue);
      return;
    }

    const monaco = (globalThis as any).monaco;
    const editor = monaco?.editor?.getEditors?.()?.[0];
    const model = editor?.getModel?.();
    if (model && monaco) {
      const r = issue.fix.edit.range;
      const range = new monaco.Range(r.startLine, r.startColumn || 1, r.endLine || r.startLine, r.endColumn || 1);
      try {
        model.pushEditOperations([], [{ range, text: issue.fix.edit.newText }], () => null);
        // persist and re-run validation
        this.code = model.getValue();
        localStorage.setItem('lastCode', this.code);
        await this.validate();
        this.toast.show({ body: `Applied fix: ${issue.fix.title}`, variant: 'success', timeout: 2500 });
      } catch (e) {
        console.error('applyFix failed', e);
        this.toast.show({ body: 'Failed to apply fix', variant: 'danger', timeout: 3000 });
      }
    } else {
      // fallback: modify code string
      const r = issue.fix.edit.range;
      const lines = this.code.split(/\r?\n/);
      const start = Math.max(0, (r.startLine || 1) - 1);
      const end = Math.max(0, (r.endLine || r.startLine || 1) - 1);
      lines.splice(start, end - start + 1, issue.fix.edit.newText);
      this.code = lines.join('\n');
      localStorage.setItem('lastCode', this.code);
      await this.validate();
    }
  }

  ngOnInit() {
    if(!isPlatformBrowser(this.platformId)) return ;
    // Load last session if available
    const savedCode = localStorage.getItem('lastCode');
    const savedLanguage = localStorage.getItem('lastLanguage');
    if (savedCode) this.code = savedCode;
    if (savedLanguage) this.selectedLanguage = savedLanguage;
    this.updateEditorLanguage();

    // Expose a minimal API so other pages (Quality dashboard) can request quick-fixes to be applied to the editor
    try {
      (globalThis as any).__reval = (globalThis as any).__reval || {};
      (globalThis as any).__reval.applyQuickFix = async (issue: ValidationIssue) => this.applyQuickFixFromDashboard(issue);
      (globalThis as any).__reval.applyFix = async (issue: ValidationIssue) => this.applyFix(issue);
      (globalThis as any).__reval.getCode = () => this.code;
      (globalThis as any).__reval.setCode = (newCode: string) => { this.code = newCode; localStorage.setItem('lastCode', this.code); this.layoutEditor(); };
    } catch (e) {
      console.warn('Failed to expose editor API', e);
    }
  }

  ngOnDestroy(): void {
    try {
      if ((globalThis as any).__reval) {
        try { delete (globalThis as any).__reval.applyQuickFix; } catch (e) { console.debug('cleanup applyQuickFix failed', e); }
          try { delete (globalThis as any).__reval.applyFix; } catch (e) { console.debug('cleanup applyFix failed', e); }
          try { delete (globalThis as any).__reval.getCode; } catch (e) { console.debug('cleanup getCode failed', e); }
          try { delete (globalThis as any).__reval.setCode; } catch (e) { console.debug('cleanup setCode failed', e); }
      }
    } catch (e) {
      console.warn('ngOnDestroy: failed to cleanup global API', e);
    }
  }

  private updateEditorLanguage() {
    this.editorOptions = {
      ...this.editorOptions,
      language: this.selectedLanguage === 'typescript' ? 'typescript' : this.selectedLanguage
    };
  }

  onCodeChange() {
    localStorage.setItem('lastCode', this.code);
    localStorage.setItem('lastLanguage', this.selectedLanguage);
  }

  async validate() {
    try {
      this.issues = await this.validationService.validate(this.code, this.selectedLanguage);
      // ensure editor recalculates layout after validation (helpful if Monaco size changed)
      this.layoutEditor();
      this.setMonacoMarkers(this.issues);
    } catch (error) {
      console.error('Validation error:', error);
      // In a real app, we'd use a toast service here
      this.toast.show({ body: 'Error during validation. Check console for details.', variant: 'danger', timeout: 4000 });
    }
  }

  async onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    // store metadata
    this.fileName = file.name;
    this.fileSize = file.size;

    if (file.size > 1024 * 1024) {
      this.toast.show({ body: 'Large file — MVP may be slow in browser.', variant: 'warning', timeout: 3000 });
    }

    try {
      const text = await file.text();
      // Update internal buffer and Monaco editor model (if available) so validators run against the full content
      this.code = text;
      const { editor } = this.getEditorAndContent();
      // Make sure language is set on the editor model before updating content
      this.updateEditorLanguage();
      try {
        const monaco = (globalThis as any).monaco;
        if (monaco && editor) {
          const model = editor.getModel?.();
          if (model && typeof monaco.editor.setModelLanguage === 'function') {
            monaco.editor.setModelLanguage(model, this.editorOptions.language);
          }
        }
      } catch (e) {
        console.debug('onFileSelected: setModelLanguage failed', e);
      }

      // Set editor content (preferred) so Monaco model contains file text top-to-bottom
      this.setEditorContent(editor, text);
      // Try to detect language from file extension
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext) {
        switch (ext) {
          case 'html':
          case 'htm':
            this.selectedLanguage = 'html';
            break;
          case 'css':
            this.selectedLanguage = 'css';
            break;
          case 'ts':
            this.selectedLanguage = 'typescript';
            break;
          case 'js':
            this.selectedLanguage = 'javascript';
            break;
        }
        // updateEditorLanguage already called above before setting model language
      }
      // run validation automatically after loading a file so the user sees results immediately
      await this.validate();
      // ensure Monaco lays out to fill the container after content is set
      this.layoutEditor();
    } catch (error) {
      console.error('Error reading file:', error);
      this.toast.show({ body: 'Error reading file. Please try again.', variant: 'danger', timeout: 3000 });
    }
  }

    copyCode() {
      if (!navigator.clipboard) {
        alert('Clipboard not available');
        return;
      }
      navigator.clipboard.writeText(this.code || '').then(() => {
        // Inform the user that the copy succeeded (matches user's requested message)
        this.toast.show({ body: 'Code Copied Successful from Preview Area', variant: 'success', timeout: 2000 });
        console.info('Code copied to clipboard');
      }).catch(err => {
        console.error('Copy failed', err);
        this.toast.show({ body: 'Copy failed — please try again.', variant: 'danger', timeout: 3000 });
      });
    }

    downloadReport() {
      const payload = {
        file: this.fileName || null,
        language: this.selectedLanguage,
        timestamp: new Date().toISOString(),
        issues: this.issues,
        code: this.code
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (this.fileName ? this.fileName + '.report.json' : 'validation-report.json');
      a.click();
      URL.revokeObjectURL(url);
    }

    clearData() {
      const ok = confirm('Clear saved session and validation data? This will remove the last saved code, language and last validation results. Continue?');
      if (!ok) return;

      // Remove well-known keys used by the app (keep theme and other preferences intact)
      const keysToRemove = ['lastCode', 'lastLanguage', 'lastValidation', 'markedFixedIssues'];
      for (const k of keysToRemove) {
        try {
          localStorage.removeItem(k);
        } catch (e) {
          console.warn('clearData: failed to remove localStorage key', k, e);
        }
      }

      // Reset in-memory state
      this.code = '';
      this.issues = [];
      this.fileName = '';
      this.fileSize = 0;
      this.layoutEditor();

  this.toast.show({ body: 'Saved session data cleared.', variant: 'success', timeout: 2000 });
    }

    private formatBytes(bytes: number) {
      if (!bytes) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    getContext(line: number) {
      if (!this.code) return '';
      const lines = this.code.split(/\r?\n/);
      const idx = Math.max(0, (line || 1) - 1);
      const start = Math.max(0, idx - 2);
      const end = Math.min(lines.length - 1, idx + 2);
      return lines.slice(start, end + 1).join('\n');
    }

  get filteredIssues(): ValidationIssue[] {
    if (this.filterType === 'all') return this.issues;
    return this.issues.filter(issue => issue.type === this.filterType);
  }

  revealLine(line: number) {
    // Monaco editor line numbers are 0-based
    const editor = (globalThis as any).monaco?.editor?.getEditors?.()?.[0];
    if (editor) {
      editor.revealLineInCenter(line);
      editor.setPosition({ lineNumber: line, column: 1 });
      editor.focus();
    }
  }

  private layoutEditor() {
    const editor = (globalThis as any).monaco?.editor?.getEditors?.()?.[0];
    if (editor && typeof editor.layout === 'function') {
      try {
        editor.layout();
      } catch (e) {
        console.debug('layoutEditor: editor.layout() failed', e);
      }
    }
  }

  // Called by other components (Quality dashboard) to apply a textual quick-fix to the editor content.
  async applyQuickFixFromDashboard(issue: ValidationIssue) {
    if (!isPlatformBrowser(this.platformId)) return;

    // obtain editor and current content
    const { editor, content: currentContent } = this.getEditorAndContent();
    const editorRef = editor;
    let content = currentContent;

    const lines = content.split(/\r?\n/);
    const idx = Math.max(0, (issue.line || 1) - 1);

    let changed = false;

    const ruleId = (issue.ruleId || '').toLowerCase();
    const msg = (issue.message || '').toLowerCase();

    // Heuristic fixes delegated to helpers (keeps cognitive complexity low)
    if (this.tryRemoveDuplicateLine(ruleId, msg, lines, idx)) changed = true;
    if (!changed && this.tryRemoveDuplicateAttribute(ruleId, msg, lines, idx)) changed = true;
    if (!changed && this.tryRemoveEmptyCssRule(ruleId, msg, lines, idx)) changed = true;

    if (!changed) {
      await this.notifyNoQuickFix(issue);
      return;
    }

    const newCode = lines.join('\n');

    // Update editor content
    this.setEditorContent(editorRef, newCode);

    // Persist and re-run validation
    localStorage.setItem('lastCode', this.code);
    await this.validate();
  }

  private async notifyNoQuickFix(issue: ValidationIssue) {
    const suggestion = issue.suggestion || 'Review the issue and apply a fix.';
    try {
      if (navigator.clipboard) await navigator.clipboard.writeText(suggestion);
    } catch (e) {
      console.debug('notifyNoQuickFix: clipboard.writeText failed', e);
    }
    this.toast.show({ body: 'No automatic quick-fix available. Suggestion copied to clipboard.', variant: 'info', timeout: 4000 });
  }

  private getEditorAndContent(): { editor: any; content: string } {
    const editor = (globalThis as any).monaco?.editor?.getEditors?.()?.[0];
    let content = this.code;
    if (editor && typeof editor.getValue === 'function') {
      try {
        content = editor.getValue();
      } catch (e) {
        console.debug('getEditorAndContent: editor.getValue failed', e);
      }
    }
    return { editor, content };
  }

  private setEditorContent(editor: any, newCode: string) {
    if (editor && typeof editor.setValue === 'function') {
      try {
        editor.setValue(newCode);
      } catch (e) {
        console.debug('setEditorContent: editor.setValue failed', e);
        this.code = newCode;
      }
    } else {
      this.code = newCode;
    }
  }

  private tryRemoveDuplicateLine(ruleId: string, msg: string, lines: string[], idx: number) {
    if (ruleId.includes('duplicate') || msg.includes('duplicate')) {
      if (idx >= 0 && idx < lines.length) {
        lines.splice(idx, 1);
        return true;
      }
    }
    return false;
  }

  private tryRemoveDuplicateAttribute(ruleId: string, msg: string, lines: string[], idx: number) {
    if (!(ruleId.includes('attr-no-duplication') || msg.includes('duplicate attribute') || (this.selectedLanguage === 'html' && msg.includes('attribute')))) return false;
    if (idx < 0 || idx >= lines.length) return false;
    const line = lines[idx];
    const tagOpen = line.indexOf('<');
    const tagClose = line.indexOf('>');
    if (tagOpen === -1 || tagClose === -1 || tagClose <= tagOpen) return false;
    const tag = line.substring(tagOpen, tagClose + 1);
    // collect attributes (best-effort single-line tags)
    const attrRegex = /(\b[\w:-]+)(\s*=\s*(?:"[^"]*"|'[^']*'|[^>\s]+))?/g;
    const seen = new Set<string>();
    let newTag = tag.replace(attrRegex, (full: string, name: string) => {
      if (seen.has(name)) return '';
      seen.add(name);
      return full;
    });
    if (newTag !== tag) {
      lines[idx] = line.replace(tag, newTag);
      return true;
    }
    return false;
  }

  private tryRemoveEmptyCssRule(ruleId: string, msg: string, lines: string[], idx: number) {
    if (!(ruleId.includes('css-empty') || msg.includes('empty css') || msg.includes('empty rule'))) return false;
    if (idx < 0 || idx >= lines.length) return false;
    // remove current line (best-effort for empty or stray braces)
    lines.splice(idx, 1);
    return true;
  }

  trackByIssue(_index: number, item: ValidationIssue) {
    return `${item.line}:${item.ruleId || item.message}`;
  }
}
