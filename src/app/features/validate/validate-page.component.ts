import { Component, Inject, OnInit, OnDestroy, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { ValidationService } from '../../core/services/validation.service';
import { ValidationIssue } from '../../core/interfaces/validation.interface';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-validate-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MonacoEditorModule],
  template: `
    <div class="row g-3 g-md-4">
      <div class="col-12">
        <!-- Mobile-optimized toolbar -->
        <div class="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-2">
          <div class="d-flex flex-wrap align-items-center gap-2">
            <select [(ngModel)]="selectedLanguage" class="form-select form-select-sm" style="width:auto;">
              <option value="html">HTML</option>
              <option value="css">CSS</option>
              <option value="typescript">TypeScript</option>
              <option value="javascript">JavaScript</option>
            </select>

            <input type="file" (change)="onFileSelected($event)" class="d-none" #fileInput />
            <button (click)="fileInput.click()" class="btn btn-outline-primary btn-sm">
              <span class="d-none d-sm-inline">Load File</span>
              <span class="d-inline d-sm-none">Load</span>
            </button>

            <button (click)="validate()" class="btn btn-primary-app btn-sm">Validate</button>

            <div *ngIf="fileName" class="text-truncate d-none d-md-block" style="max-width:200px">
              <small class="text-muted">{{ fileName }}</small>
            </div>
          </div>

          <div class="d-flex flex-wrap align-items-center gap-2">
            <button class="btn btn-sm btn-outline-secondary" (click)="copyCode()" title="Copy code to clipboard">
              <span class="d-none d-md-inline">Copy Code</span>
              <span class="d-inline d-md-none">Copy</span>
            </button>
            <button class="btn btn-sm btn-outline-secondary" (click)="downloadReport()" title="Download validation report">
              <span class="d-none d-md-inline">Download</span>
              <span class="d-inline d-md-none">⬇</span>
            </button>
            <button class="btn btn-sm btn-outline-danger" title="Clear saved code / validation data" (click)="clearData()">
              <span class="d-none d-sm-inline">Clear</span>
              <span class="d-inline d-sm-none">✕</span>
            </button>
          </div>
        </div>

        <!-- Mobile file info -->
        <div *ngIf="fileName" class="mt-2 d-md-none">
          <small class="text-muted">Loaded: <strong>{{ fileName }}</strong> <span class="text-muted">({{ fileSizeStr }})</span></small>
        </div>
      </div>

      <div class="col-12 col-lg-8" style="height: 68vh;">
        <div class="panel-card h-100">
          <ngx-monaco-editor [options]="editorOptions" [(ngModel)]="code" (ngModelChange)="onCodeChange()"></ngx-monaco-editor>
        </div>
      </div>

      <div class="col-12 col-lg-4">
        <div class="panel-card results-panel h-100 d-flex flex-column">
          <div class="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center mb-3 gap-2">
            <h5 class="mb-0">Validation</h5>
            <div class="btn-group btn-group-sm" role="group">
              <button type="button" class="btn btn-outline-secondary" [class.active]="filterType==='all'" (click)="filterType = 'all'">All</button>
              <button type="button" class="btn btn-outline-danger" [class.active]="filterType==='error'" (click)="filterType = 'error'">
                <span class="d-none d-sm-inline">Errors</span>
                <span class="d-inline d-sm-none">Err</span>
              </button>
              <button type="button" class="btn btn-outline-warning" [class.active]="filterType==='warning'" (click)="filterType = 'warning'">
                <span class="d-none d-sm-inline">Warnings</span>
                <span class="d-inline d-sm-none">Warn</span>
              </button>
            </div>
          </div>

          <div class="mb-3">
            <div class="row g-2">
              <div class="col-4">
                <div class="card text-center p-2">
                  <div class="h3 mb-0 text-danger">{{ errorCount }}</div>
                  <div class="small text-muted">
                    <span class="d-none d-sm-inline">Errors</span>
                    <span class="d-inline d-sm-none">Err</span>
                  </div>
                </div>
              </div>
              <div class="col-4">
                <div class="card text-center p-2">
                  <div class="h3 mb-0 text-warning">{{ warningCount }}</div>
                  <div class="small text-muted">
                    <span class="d-none d-sm-inline">Warnings</span>
                    <span class="d-inline d-sm-none">Warn</span>
                  </div>
                </div>
              </div>
              <div class="col-4">
                <div class="card text-center p-2">
                  <div class="h3 mb-0 text-info">{{ infoCount }}</div>
                  <div class="small text-muted">Info</div>
                </div>
              </div>
            </div>

            <!-- Go to Quality Dashboard button (shown after validation) -->
            <div *ngIf="issues.length > 0" class="mt-3">
              <button class="btn btn-primary w-100 btn-sm d-flex align-items-center justify-content-center gap-2" (click)="goToQualityDashboard()" title="View detailed analysis in Quality Dashboard">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
                <span>Go to Quality Dashboard</span>
              </button>
            </div>
          </div>

          <!-- Preview (hidden on small screens to save space) -->
          <div class="mb-3 d-none d-md-block">
            <div class="small text-muted mb-1">Preview</div>
            <div class="preview-box p-2 rounded bg-white text-dark" style="max-height:140px;overflow:auto;white-space:pre-wrap;word-break:break-word;border:1px solid #e9ecef">{{ code || '(no file loaded)' }}</div>
          </div>

          <div class="flex-grow-1 overflow-auto">
            <div *ngIf="filteredIssues.length === 0" class="text-center text-muted-small py-4">No issues found.</div>

            <div *ngFor="let issue of filteredIssues; trackBy: trackByIssue" class="mb-2 p-2 p-md-3 rounded" [ngStyle]="{
                  'background-color': issue.type === 'error' ? '#fee' : (issue.type === 'warning' ? '#fff3cd' : '#e7f3ff'),
                  'border': '1px solid ' + (issue.type === 'error' ? '#dc3545' : (issue.type === 'warning' ? '#ffc107' : '#0dcaf0'))
                }">
              <div class="d-flex flex-column flex-sm-row justify-content-between gap-2">
                <div style="min-width:0;flex:1">
                  <div class="d-flex align-items-start mb-2">
                    <span class="badge me-2 text-capitalize" [ngStyle]="{
                      'background-color': issue.type === 'error' ? '#dc3545' : (issue.type === 'warning' ? '#ffc107' : '#0dcaf0'),
                      'color': issue.type === 'warning' ? '#000' : '#fff'
                    }">{{ issue.type }}</span>
                    <div class="fw-semibold small" style="color:#212529">{{ issue.message }}</div>
                  </div>
                  <div class="small mb-2" style="color:#6c757d;font-size:0.8rem">
                    Line {{ issue.line }}<span *ngIf="issue.column">:{{ issue.column }}</span>
                    <span *ngIf="issue.ruleId" class="ms-2 d-none d-sm-inline">• {{ issue.ruleId }}</span>
                  </div>
                  <div class="mt-2 small d-none d-sm-block">
                    <code class="d-block p-2 rounded" style="background-color:#f8f9fa;color:#212529;white-space:pre-wrap;word-break:break-all;border:1px solid #dee2e6;font-size:0.75rem">{{ getContext(issue.line) }}</code>
                  </div>
                  <div *ngIf="issue.suggestion" class="mt-2 small alert alert-success mb-0 py-1 px-2">
                    <strong>💡</strong> <span class="d-none d-sm-inline">Suggestion:</span> {{ issue.suggestion }}
                  </div>
                </div>
                <div class="d-flex flex-row flex-sm-column align-items-center align-items-sm-end gap-2">
                  <button class="btn btn-sm btn-outline-primary" (click)="revealLine(issue.line)" style="white-space:nowrap;font-size:0.75rem">
                    <span class="d-none d-sm-inline"><i class="bi bi-arrow-right-circle"></i> Go to Line</span>
                    <span class="d-inline d-sm-none">Go</span>
                  </button>
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

  constructor(
    public validationService: ValidationService,
    @Inject(PLATFORM_ID) public platformId: Object,
    private readonly toast: ToastService,
    private readonly router: Router
  ) {}

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
        this.toast.show({
          body: `✓ Fix applied: ${issue.fix.title}. Re-validated successfully.`,
          variant: 'success',
          timeout: 3000
        });
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
      this.toast.show({
        body: `✓ Fix applied: ${issue.fix.title}. Re-validated successfully.`,
        variant: 'success',
        timeout: 3000
      });
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
    // This API persists across navigation and always references the current component instance
    try {
      if (!(globalThis as any).__reval) {
        (globalThis as any).__reval = {};
      }

      // Always update the API to reference the current (latest) component instance
      (globalThis as any).__reval.applyQuickFix = async (issue: ValidationIssue) => this.applyQuickFixFromDashboard(issue);
      (globalThis as any).__reval.applyFix = async (issue: ValidationIssue) => this.applyFix(issue);
      (globalThis as any).__reval.getCode = () => this.code;
      (globalThis as any).__reval.setCode = (newCode: string) => { this.code = newCode; localStorage.setItem('lastCode', this.code); this.layoutEditor(); };

      console.log('Editor API registered successfully');
    } catch (e) {
      console.warn('Failed to expose editor API', e);
    }
  }

  ngOnDestroy(): void {
    // DO NOT clean up the global API - it needs to remain available for the Quality Dashboard
    // even when the Validate page is not currently visible. The API will be re-initialized
    // if the user navigates back to the Validate page.
    // The API will only be truly cleaned when the entire app is unloaded.
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

    // Auto-detect language only if substantial code is present (like when pasting)
    // Only detect if code has more than 50 characters to avoid detection on small edits
    if (this.code && this.code.trim().length > 50) {
      const detectedLanguage = this.detectLanguageFromCode(this.code);
      if (detectedLanguage && detectedLanguage !== this.selectedLanguage) {
        // Auto-switch language
        this.selectedLanguage = detectedLanguage;
        this.updateEditorLanguage();
        this.toast.show({
          body: `Language auto-detected: ${detectedLanguage.toUpperCase()}`,
          variant: 'info',
          timeout: 2500
        });
      }
    }
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

      // Run validation automatically after loading a file so the user sees results immediately
      await this.validate();
      // Ensure Monaco lays out to fill the container after content is set
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
      this.selectedLanguage = 'html';
      this.layoutEditor();

      this.toast.show({ body: '✓ Session data cleared successfully.', variant: 'success', timeout: 2000 });
    }

    goToQualityDashboard() {
      this.router.navigate(['/quality']);
    }

    private validateFileType(fileExtension: string, selectedLanguage: string): boolean {
      const extensionMap: { [key: string]: string[] } = {
        'html': ['html', 'htm'],
        'css': ['css'],
        'typescript': ['ts'],
        'javascript': ['js']
      };

      const validExtensions = extensionMap[selectedLanguage] || [];
      return validExtensions.includes(fileExtension);
    }

    private detectLanguageFromCode(code: string): string | null {
      if (!code || code.trim().length === 0) return null;

      const trimmedCode = code.trim();

      // HTML detection - look for HTML tags
      const hasHtmlTags = /<(!DOCTYPE html|html|head|body|div|span|p|a|img|script|style|meta|link)/i.test(trimmedCode);
      const hasClosingTags = /<\/[a-z]+>/i.test(trimmedCode);
      if (hasHtmlTags || (trimmedCode.includes('<') && hasClosingTags)) {
        return 'html';
      }

      // CSS detection - look for CSS selectors and properties
      const hasCssSelector = /[.#]?[\w-]+\s*\{[\s\S]*\}/m.test(trimmedCode);
      const hasCssProperty = /[\w-]+\s*:\s*[^;]+;/m.test(trimmedCode);
      const hasMediaQuery = /@media|@import|@keyframes/i.test(trimmedCode);
      if (hasCssSelector || (hasCssProperty && !trimmedCode.includes('const') && !trimmedCode.includes('let') && !trimmedCode.includes('var')) || hasMediaQuery) {
        return 'css';
      }

      // TypeScript detection - look for TS-specific syntax
      const hasTypeAnnotation = /:\s*(string|number|boolean|any|void|never|unknown|object)\b/m.test(trimmedCode);
      const hasInterface = /\binterface\s+\w+/m.test(trimmedCode);
      const hasTypeAlias = /\btype\s+\w+\s*=/m.test(trimmedCode);
      const hasGeneric = /<[A-Z]\w*>/m.test(trimmedCode);
      const hasEnum = /\benum\s+\w+/m.test(trimmedCode);
      if (hasTypeAnnotation || hasInterface || hasTypeAlias || hasGeneric || hasEnum) {
        return 'typescript';
      }

      // JavaScript detection - look for JS-specific patterns
      const hasJsKeywords = /\b(const|let|var|function|class|import|export|require|module\.exports)\b/m.test(trimmedCode);
      const hasArrowFunction = /=>\s*[{(]/m.test(trimmedCode);
      const hasJsMethod = /\.\w+\([^)]*\)/m.test(trimmedCode);
      if (hasJsKeywords || hasArrowFunction || hasJsMethod) {
        return 'javascript';
      }

      // Default: return null if unable to detect
      return null;
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
    if (!changed && this.tryAddMissingAltAttribute(ruleId, msg, lines, idx)) changed = true;
    if (!changed && this.tryAddClosingTag(ruleId, msg, issue, lines, idx)) changed = true;

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

    this.toast.show({
      body: `✓ Heuristic fix applied for ${issue.ruleId || 'issue'}. Code updated and re-validated.`,
      variant: 'success',
      timeout: 3000
    });
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
    // Only remove entire line for CSS duplicate properties (not for HTML duplicates)
    if (this.selectedLanguage === 'css' && (ruleId.includes('css-duplicate-property') || msg.includes('duplicate property'))) {
      if (idx >= 0 && idx < lines.length) {
        // Check if this line is just a property declaration
        const line = lines[idx].trim();
        // Only remove if it looks like a simple CSS property (property: value;)
        if (/^[\w-]+\s*:\s*[^;]*;?\s*$/.test(line)) {
          lines.splice(idx, 1);
          return true;
        }
      }
    }
    return false;
  }

  private tryRemoveDuplicateAttribute(ruleId: string, msg: string, lines: string[], idx: number) {
    if (!(ruleId.includes('attr-no-duplication') || ruleId.includes('html-duplicate-attr') || msg.includes('duplicate attribute'))) return false;
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

    // For empty CSS rules, we need to remove the selector and the empty braces
    // Look for patterns like: .selector { } or #id { }
    let removed = false;

    // Check if current line has empty braces
    if (lines[idx].includes('{}') || lines[idx].trim() === '{}') {
      lines.splice(idx, 1);
      removed = true;
    } else if (lines[idx].includes('{') && !lines[idx].includes('}')) {
      // Selector line with opening brace, check next line for closing brace
      if (idx + 1 < lines.length && lines[idx + 1].trim() === '}') {
        lines.splice(idx, 2); // Remove both lines
        removed = true;
      }
    }

    return removed;
  }

  private tryAddMissingAltAttribute(ruleId: string, msg: string, lines: string[], idx: number) {
    if (!(ruleId.includes('img-alt') || msg.includes('missing alt'))) return false;
    if (idx < 0 || idx >= lines.length) return false;

    const line = lines[idx];
    // Find img tag on this line
    const imgMatch = line.match(/<img\s+([^>]*)>/i);
    if (!imgMatch) return false;

    const imgTag = imgMatch[0];
    const attributes = imgMatch[1];

    // Check if alt already exists (should not, but safety check)
    if (/\balt\s*=/i.test(attributes)) return false;

    // Add alt="" before the closing >
    let newImgTag: string;
    if (attributes.trim().endsWith('/')) {
      // Self-closing tag: <img src="..." />
      newImgTag = imgTag.replace(/\s*\/?>/, ' alt="" />');
    } else {
      // Regular tag: <img src="...">
      newImgTag = imgTag.replace(/>/, ' alt="">');
    }

    lines[idx] = line.replace(imgTag, newImgTag);
    return true;
  }

  private tryAddClosingTag(ruleId: string, msg: string, issue: ValidationIssue, lines: string[], idx: number) {
    if (!(ruleId.includes('unclosed') || ruleId.includes('html-unclosed-tag') || msg.includes('unclosed tag'))) return false;
    if (idx < 0 || idx >= lines.length) return false;

    // Extract tag name from message like "Unclosed tag <div>"
    const tagMatch = msg.match(/<([a-zA-Z][a-zA-Z0-9]*)/);
    if (!tagMatch) return false;

    const tagName = tagMatch[1];
    const line = lines[idx];

    // Check if the opening tag is on this line
    const openingTagPattern = new RegExp(`<${tagName}[\\s>]`, 'i');
    if (!openingTagPattern.test(line)) return false;

    // Find the end of the opening tag
    const tagEndIndex = line.indexOf('>', line.indexOf(`<${tagName}`));
    if (tagEndIndex === -1) return false;

    // Add the closing tag at the end of the line
    lines[idx] = line + `</${tagName}>`;
    return true;
  }

  trackByIssue(_index: number, item: ValidationIssue) {
    return `${item.line}:${item.ruleId || item.message}`;
  }
}
