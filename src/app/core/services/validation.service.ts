import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ValidationIssue, ValidationReport, QuickFix, Range } from '../interfaces/validation.interface';
// Load some heavy/optional libraries dynamically to avoid build-time errors
// when types or packages are missing in some environments.
let htmlhint: any = null;
let postcss: any = null;
let safeParser: any = null;
let cssTree: any = null;
let ts: any = null;

@Injectable({
  providedIn: 'root'
})
export class ValidationService {
  // Helper to perform a runtime-only dynamic import that is harder for bundlers to statically analyze.
  // Using the Function constructor prevents many bundlers from resolving the specifier at build time
  // and avoids pulling node-only modules (like 'typescript') into the client bundle.
  private async runtimeImport(spec: string): Promise<any> {
    // eslint-disable-next-line no-new-func
    const fn = new Function('s', 'return import(s)');
    return fn(spec);
  }
  private lastValidationSubject = new BehaviorSubject<ValidationReport | null>(null);
  lastValidation$ = this.lastValidationSubject.asObservable();

  constructor() {}

  async validateHtml(code: string): Promise<ValidationIssue[]> {
    // lazy-load htmlhint
    if (!htmlhint) {
      try {
        const mod = await import('htmlhint');
        // htmlhint exports HTMLHint
        htmlhint = mod;
      } catch (e) {
        htmlhint = null;
      }
    }

    if (htmlhint && htmlhint.HTMLHint) {
      const results = htmlhint.HTMLHint.verify(code, {
      'tagname-lowercase': true,
      'attr-lowercase': true,
      'attr-value-double-quotes': true,
      'doctype-first': true,
      'tag-pair': true,
      'spec-char-escape': true,
      'id-unique': true,
      'src-not-empty': true,
      'attr-no-duplication': true
    });

      const mapped = (results as any[]).map((result: any) => ({
        type: result.type as ValidationIssue['type'],
        message: result.message,
        line: result.line,
        column: result.col,
        ruleId: result.rule?.id,
        suggestion: this.suggestHtmlFix(result.rule?.id, result.message),
        range: { startLine: result.line, startColumn: result.col }
      } as ValidationIssue));

      // Additional lightweight DOM-based checks (browser only)
      try {
        if (typeof DOMParser !== 'undefined') {
          const doc = new DOMParser().parseFromString(code, 'text/html');
          // find images without alt
          const imgs = Array.from(doc.querySelectorAll('img'));
          imgs.forEach((img: any) => {
            if (!img.hasAttribute('alt') || img.getAttribute('alt').trim() === '') {
              mapped.push({ type: 'warning', message: 'Image missing alt attribute', line: 1, ruleId: 'img-alt', suggestion: 'Add descriptive alt="..." to <img> elements.', range: { startLine: 1, startColumn: 1 } });
            }
            // duplicate attributes detection
            const attrs = Array.from(img.attributes).map((a: any) => a.name);
            const dup = attrs.find((v: string, i: number, arr: string[]) => arr.indexOf(v) !== i);
            if (dup) {
              mapped.push({ type: 'warning', message: `Duplicate attribute '${dup}' on <img>`, line: 1, ruleId: 'attr-dup', suggestion: 'Remove duplicate attribute instances.', range: { startLine: 1, startColumn: 1 } });
            }
          });
        }
      } catch (e) {
        // ignore DOM parse errors in non-browser contexts
      }

      return mapped;
    }

    // Fallback: no htmlhint available — perform a small sanity check and DOM checks
  const fallback: ValidationIssue[] = [];
    if (!code.includes('<') || !code.includes('>')) {
  fallback.push({ type: 'warning', message: 'Content does not appear to be HTML', line: 1, suggestion: 'Ensure file contains valid HTML tags.', range: { startLine: 1, startColumn: 1 } });
      return fallback;
    }

    try {
      if (typeof DOMParser !== 'undefined') {
        const doc = new DOMParser().parseFromString(code, 'text/html');
        const imgs = Array.from(doc.querySelectorAll('img'));
        imgs.forEach((img: any) => {
          if (!img.hasAttribute('alt') || img.getAttribute('alt').trim() === '') {
            fallback.push({ type: 'warning', message: 'Image missing alt attribute', line: 1, ruleId: 'img-alt', suggestion: 'Add descriptive alt="..." to <img> elements.', range: { startLine: 1, startColumn: 1 } });
          }
        });
      }
    } catch (e) {
      // ignore
    }

    return fallback;
  }

  async validateCss(code: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    try {
      // lazy-load css-tree
      if (!cssTree) {
        try {
          cssTree = await this.runtimeImport('css-tree');
        } catch (e) {
          cssTree = null;
        }
      }

      if (!cssTree) {
        // If css-tree not available, return a parse-warning
        issues.push({ type: 'warning', message: 'CSS parsing not available (css-tree missing)', line: 1, ruleId: 'css-parser-missing' });
        return issues;
      }

      // Request positional information so nodes include .loc.start.line
      // css-tree supports a `positions: true` option to populate location info.
      let ast: any;
      try {
        ast = cssTree.parse(code, { positions: true });
      } catch (e) {
        // fallback to default parse if option not supported
        ast = cssTree.parse(code);
      }
      // collect selector -> declarations map for duplicate/conflict detection
      const selectorMap = new Map<string, Array<{ prop: string; value: string; line: number }>>();

      cssTree.walk(ast, {
        visit: 'Rule',
        enter: (node: any) => {
          // Check for empty rules
          if (!node.block.children.length) {
            const lineNum = node.loc?.start.line || 1;
            issues.push({
              type: 'warning',
              message: 'Empty rule',
              line: lineNum,
              ruleId: 'css-empty-rule',
              range: { startLine: lineNum }
            });
          }

          // Collect declarations for this rule
          const selector = cssTree.generate(node.prelude || node.selector || node.rule || node); // fallback
          const decls: Array<{ prop: string; value: string; line: number }> = [];
          cssTree.walk(node, {
            visit: 'Declaration',
            enter: (decl: any) => {
              const prop = decl.property;
              const val = cssTree.generate(decl.value || decl);
              const line = decl.loc?.start.line || 1;
              // duplicate property detection within same rule
              const dup = decls.find(d => d.prop === prop);
              if (dup) {
                const fix: QuickFix = {
                  title: `Remove duplicate property ${prop}`,
                  edit: { range: { startLine: line, startColumn: 1, endLine: line, endColumn: 9999 }, newText: '' },
                  confidence: 'high',
                  isSafe: true
                };
                issues.push({ type: 'warning', message: `Duplicate property '${prop}'`, line, ruleId: 'css-duplicate-property', suggestion: `Remove duplicate '${prop}' or merge values.`, range: { startLine: line, startColumn: 1 }, fix });
              }
              decls.push({ prop, value: val, line });
            }
          });

          if (selector && decls.length) {
            const key = selector.toString();
            if (!selectorMap.has(key)) selectorMap.set(key, []);
            selectorMap.get(key)!.push(...decls);
          }
        }
      });

      // Check for duplicate selectors and conflicting declarations
      for (const [sel, decls] of selectorMap.entries()) {
          if (decls.length > 0) {
          // group by property
          const propMap = new Map<string, Set<string>>();
          decls.forEach(d => {
            if (!propMap.has(d.prop)) propMap.set(d.prop, new Set());
            propMap.get(d.prop)!.add(d.value);
          });
          for (const [prop, vals] of propMap.entries()) {
            if (vals.size > 1) {
              const ln = decls[0]?.line || 1;
              issues.push({ type: 'warning', message: `Conflicting values for '${prop}' in selector '${sel}'`, line: ln, ruleId: 'css-conflicting-values', suggestion: `Consolidate conflicting '${prop}' values for selector ${sel}.`, range: { startLine: ln } });
            }
          }
          // if selector appears multiple times (we added declarations per occurrence), detect it
          // simple heuristic: if more than 8 declarations combined, flag potential duplication
          if (decls.length > 8) {
            const ln = decls[0]?.line || 1;
            issues.push({ type: 'warning', message: `Selector '${sel}' has many declarations (possible duplication)`, line: ln, ruleId: 'css-large-rule', suggestion: 'Consider splitting or deduplicating CSS rules.', range: { startLine: ln } });
          }
        }
      }
    } catch (error: any) {
      issues.push({
        type: 'error',
        message: error.message,
        line: error.line || 1,
        column: error.column,
        ruleId: 'css-parse-error',
        range: { startLine: error.line || 1 }
      });
    }

    return issues;
  }

  async validateTs(code: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    try {
      // lazy-load TypeScript compiler
      if (!ts) {
        try {
          ts = await this.runtimeImport('typescript');
        } catch (e) {
          ts = null;
        }
      }

      if (!ts) {
        issues.push({ type: 'warning', message: 'TypeScript compiler not available', line: 1, ruleId: 'ts-missing' });
        return issues;
      }

      const { diagnostics } = ts.transpileModule(code, {
        compilerOptions: {
          target: ts.ScriptTarget.ESNext,
          module: ts.ModuleKind.ESNext,
          strict: true
        },
        reportDiagnostics: true
      });

      if (diagnostics) {
        diagnostics.forEach((diagnostic: any) => {
          if (diagnostic.file && diagnostic.start) {
            const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
            const range: Range = { startLine: line + 1, startColumn: character + 1 };
            issues.push({
              type: 'error',
              message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
              line: line + 1,
              column: character + 1,
              ruleId: `ts-${diagnostic.code}`,
              suggestion: this.suggestTsFix(diagnostic),
              range
            });
          }
        });
      }
    } catch (error: any) {
      issues.push({
        type: 'error',
        message: error.message,
        line: 1,
        ruleId: 'ts-parse-error'
      });
    }

    return issues;
  }

  async validateJs(code: string): Promise<ValidationIssue[]> {
    // For MVP, we'll use the same TypeScript validator but with less strict options
    return this.validateTs(code);
  }

  private suggestHtmlFix(ruleId: string | undefined, message: string) {
    const id = (ruleId || '').toLowerCase();
    if (id.includes('tagname-lowercase')) return 'Use lowercase tag names: <div> not <DIV>.';
    if (id.includes('attr-lowercase')) return 'Use lowercase attribute names.';
    if (id.includes('attr-value-double-quotes')) return 'Wrap attribute values in double quotes.';
    if (id.includes('doctype-first')) return 'Add <!doctype html> at the top of the document.';
    if (id.includes('id-unique')) return 'Ensure element id attributes are unique within the document.';
    if (id.includes('src-not-empty')) return 'Ensure src attributes are not empty.';
    return message ? `Review: ${message}` : 'Review HTML and follow best practices.';
  }

  private suggestTsFix(diagnostic: any) {
    // Simple mapping of some TS diagnostic codes to guidance
    const code = diagnostic.code;
    if (!code) return 'Fix TypeScript error reported by compiler.';
    const num = Number(code);
    if (num === 2304) return 'Identifier not found — check imports and declarations.';
    if (num === 2322) return 'Type mismatch — consider adjusting types or using type assertions carefully.';
    if (num === 2551) return 'Function or method overload issue — check provided arguments.';
    return 'Fix TypeScript error reported by compiler.';
  }

  private updateLastValidation(language: string, issues: ValidationIssue[]) {
    const summary = {
      errors: issues.filter(i => i.type === 'error').length,
      warnings: issues.filter(i => i.type === 'warning').length,
      info: issues.filter(i => i.type === 'info').length
    };

    this.lastValidationSubject.next({
      language,
      timestamp: new Date().toISOString(),
      issues,
      summary
    });
  }

  async validate(code: string, language: string): Promise<ValidationIssue[]> {
    let issues: ValidationIssue[] = [];

    switch (language.toLowerCase()) {
      case 'html':
        issues = await this.validateHtml(code);
        break;
      case 'css':
        issues = await this.validateCss(code);
        break;
      case 'typescript':
      case 'ts':
        issues = await this.validateTs(code);
        break;
      case 'javascript':
      case 'js':
        issues = await this.validateJs(code);
        break;
      default:
        throw new Error(`Unsupported language: ${language}`);
    }

    // Deduplicate issues with same type/line/column/rule/message to avoid repeated identical markers
    const seen = new Set<string>();
    const dedup: ValidationIssue[] = [];
    for (const it of issues) {
      const key = `${it.type}|${it.line || 0}|${it.column || 0}|${it.ruleId || ''}|${(it.message || '').trim()}`;
      if (!seen.has(key)) {
        seen.add(key);
        dedup.push(it);
      }
    }

    this.updateLastValidation(language, dedup);
    return dedup;
  }
}