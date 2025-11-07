import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ValidationIssue, ValidationReport, QuickFix, Range } from '../interfaces/validation.interface';
import * as csstree from 'css-tree';
import { HTMLHint } from 'htmlhint';

@Injectable({
  providedIn: 'root'
})
export class ValidationService {
  private lastValidationSubject = new BehaviorSubject<ValidationReport | null>(null);
  lastValidation$ = this.lastValidationSubject.asObservable();

  constructor() {}

  async validateHtml(code: string): Promise<ValidationIssue[]> {
    try {
      const results = HTMLHint.verify(code, {
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

      // Additional HTML checks (DOMParser + regex helpers) to catch issues htmlhint may miss or to ensure
      // we map them reliably to line numbers.
      const extra = this.htmlExtraChecks(code);
      mapped.push(...extra);
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
    } catch (error) {
      console.error('HTMLHint validation error:', error);
      // Fallback: perform basic checks when HTMLHint fails
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
  }

  private htmlExtraChecks(code: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const lines = code.split(/\r?\n/);

    // Helper to find line number by index
    const lineOf = (idx: number) => {
      const prefix = code.slice(0, idx);
      return prefix.split(/\r?\n/).length;
    };

    // 1) Duplicate id across document
    const idRegex = /\bid\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi;
    const ids = new Map<string, number[]>();
    let m: RegExpExecArray | null;
    while ((m = idRegex.exec(code))) {
      const id = (m[1] || m[2] || m[3] || '').trim();
      if (!id) continue;
      const ln = lineOf(m.index);
      if (!ids.has(id)) ids.set(id, []);
      ids.get(id)!.push(ln);
    }
    for (const [id, arr] of ids.entries()) {
      if (arr.length > 1) {
        for (const ln of arr) {
          issues.push({ type: 'warning', message: `Duplicate id '${id}'`, line: ln, ruleId: 'html-duplicate-id', suggestion: `Ensure id='${id}' is unique.`, range: { startLine: ln } });
        }
      }
    }

    // 2) img missing alt
    const imgRegex = /<img\b[^>]*>/gi;
    while ((m = imgRegex.exec(code))) {
      const tag = m[0];
      if (!/\balt\s*=/.test(tag)) {
        const ln = lineOf(m.index);
        issues.push({ type: 'warning', message: 'Image missing alt attribute', line: ln, ruleId: 'img-alt', suggestion: 'Add descriptive alt="..." to <img> elements.', range: { startLine: ln } });
      }
    }

    // 3) duplicate attribute names in a single tag (e.g., duplicate class)
    const tagRegex = /<([a-zA-Z0-9-]+)\b([^>]*)>/gi;
    while ((m = tagRegex.exec(code))) {
      const attrs = m[2] || '';
      const attrRegex = /([\w:-]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^>\s]+))?/g;
      const seen = new Map<string, number>();
      let a: RegExpExecArray | null;
      while ((a = attrRegex.exec(attrs))) {
        const name = a[1];
        const absIndex = m.index + a.index;
        const ln = lineOf(absIndex);
        if (!seen.has(name)) seen.set(name, ln); else {
          issues.push({ type: 'warning', message: `Duplicate attribute '${name}' on <${m[1]}>`, line: ln, ruleId: 'html-duplicate-attr', suggestion: `Remove duplicated '${name}' attribute.`, range: { startLine: ln } });
        }
      }
    }

    // 4) simple unclosed tag detection (best-effort): track opening/closing tags for non-void elements
    const voids = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
    const tagAll = /<\/?([a-zA-Z0-9-]+)(?:\s[^>]*)?>/g;
    const stack: Array<{tag:string; idx:number}> = [];
    while ((m = tagAll.exec(code))) {
      const full = m[0];
      const name = m[1].toLowerCase();
      if (full.startsWith('</')) {
        if (stack.length && stack[stack.length-1].tag === name) stack.pop();
      } else {
        if (!voids.has(name)) stack.push({ tag: name, idx: m.index });
      }
    }
    for (const s of stack) {
      const ln = lineOf(s.idx);
      issues.push({ type: 'error', message: `Unclosed tag <${s.tag}>`, line: ln, ruleId: 'html-unclosed-tag', suggestion: `Add closing </${s.tag}>.`, range: { startLine: ln } });
    }

    return issues;
  }

  async validateCss(code: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    try {
      // Use css-tree which is now imported at the top
      if (!csstree) {
        issues.push({ type: 'warning', message: 'CSS parsing not available (css-tree missing)', line: 1, ruleId: 'css-parser-missing' });
        return issues;
      }

      // Request positional information so nodes include .loc.start.line
      // css-tree supports a `positions: true` option to populate location info.
      let ast: any;
      try {
        ast = csstree.parse(code, { positions: true });
      } catch (e) {
        // fallback to default parse if option not supported
        ast = csstree.parse(code);
      }
      // collect selector -> declarations map for duplicate/conflict detection
      const selectorMap = new Map<string, Array<{ prop: string; value: string; line: number }>>();

      try {
        csstree.walk(ast, {
          visit: 'Rule',
          enter(node: any) {
            const lineNum = node.loc && node.loc.start ? node.loc.start.line : 1;
            const hasChildren = node.block && node.block.children && typeof node.block.children.getSize === 'function'
              ? node.block.children.getSize()
              : (node.block && node.block.children ? node.block.children.length : 0);
            if (!hasChildren) {
              issues.push({ type: 'warning', message: 'Empty rule', line: lineNum, ruleId: 'css-empty-rule', range: { startLine: lineNum } });
            }

            const decls: Array<{ prop: string; value: string; line: number }> = [];
            const selector = (() => {
              try { return csstree.generate(node.prelude || node.selector || node.rule || node); } catch { return String(node); }
            })();

            try {
              csstree.walk(node, {
                visit: 'Declaration',
                enter(decl: any) {
                  const prop = decl.property || '<unknown>';
                  let val = '';
                  try { val = csstree.generate(decl.value || decl); } catch { val = '' + (decl.value || ''); }
                  const ln = decl.loc && decl.loc.start ? decl.loc.start.line : lineNum;
                  const raw = (val || '').toString().trim();
                  if (!raw || /^;?$/.test(raw)) {
                    issues.push({ type: 'warning', message: `Empty declaration for '${prop}'`, line: ln, ruleId: 'css-empty-declaration', suggestion: `Provide a value for '${prop}' or remove the declaration.`, range: { startLine: ln, startColumn: 1 } });
                  }
                  const dup = decls.find(d => d.prop === prop);
                  if (dup) {
                    const fix: QuickFix = {
                      title: `Remove duplicate property ${prop}`,
                      edit: { range: { startLine: ln, startColumn: 1, endLine: ln, endColumn: 9999 }, newText: '' },
                      confidence: 'high',
                      isSafe: true
                    };
                    issues.push({ type: 'warning', message: `Duplicate property '${prop}'`, line: ln, ruleId: 'css-duplicate-property', suggestion: `Remove duplicate '${prop}' or merge values.`, range: { startLine: ln, startColumn: 1 }, fix });
                  }
                  decls.push({ prop, value: val, line: ln });
                }
              });
            } catch (e: any) {
              // inner walk error — report and continue
              issues.push({ type: 'error', message: e?.message || String(e), line: lineNum, ruleId: 'css-walk-error', range: { startLine: lineNum } });
            }

            if (selector && decls.length) {
              const key = selector.toString();
              if (!selectorMap.has(key)) selectorMap.set(key, []);
              selectorMap.get(key)!.push(...decls);
            }
          }
        });
      } catch (e: any) {
        // top-level walk failure
        issues.push({ type: 'error', message: e?.stack || String(e), line: 1, ruleId: 'css-walk-top-error', range: { startLine: 1 } });
      }

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

    // Quick heuristic checks (catch common TS issues even if full compiler diagnostics miss them)
    try {
      const lineOf = (idx: number) => code.slice(0, idx).split(/\r?\n/).length;

      // 1) class fields without type declaration (e.g., `name;`)
      const classFieldRegex = /^[ \t]*(?:public|private|protected|readonly\s+)?([A-Za-z_$][\w$]*)\s*;$/gm;
      let m: RegExpExecArray | null;
      while ((m = classFieldRegex.exec(code))) {
        const name = m[1];
        const ln = lineOf(m.index);
        issues.push({ type: 'warning', message: `Class field '${name}' missing type declaration`, line: ln, ruleId: 'ts-missing-field-type', suggestion: `Add a type annotation, e.g. '${name}: string;'.`, range: { startLine: ln } });
      }

      // 2) typed variable assigned a literal of a different basic type
      const typedAssignRegex = /\b(?:let|const|var)\s+([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$<>\[\]]*)\s*=\s*("[^"]*"|'[^']*'|`[^`]*`|\d+(?:\.\d+)?)/g;
      while ((m = typedAssignRegex.exec(code))) {
        const varName = m[1];
        const declared = (m[2] || '').toLowerCase();
        const value = m[3] || '';
        const ln = lineOf(m.index);
        const isStringLiteral = /^['"`]/.test(value);
        const isNumberLiteral = /^\d/.test(value);
        if ((declared === 'number' && isStringLiteral) || (declared === 'string' && isNumberLiteral)) {
          issues.push({ type: 'error', message: `Type mismatch assigning ${value} to ${declared} '${varName}'`, line: ln, ruleId: 'ts-type-mismatch', suggestion: `Assign a value matching type '${declared}'.`, range: { startLine: ln } });
        }
      }

      // 3) constructor call type mismatches (best-effort): find class constructor param types and check `new` calls
      const classCtorRegex = /class\s+([A-Za-z_$][\w$]*)[^{]*\{[\s\S]*?constructor\s*\(([^)]*)\)/g;
      const newCallRegex = /new\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/g;
      const ctorMap = new Map<string, string[]>();
      let c: RegExpExecArray | null;
      while ((c = classCtorRegex.exec(code))) {
        const cls = c[1];
        const params = c[2];
        const parts: string[] = [];
        const paramRegex = /[A-Za-z_$][\w$]*\s*:\s*([A-Za-z_$][\w$<>\[\]]*)/g;
        let p: RegExpExecArray | null;
        while ((p = paramRegex.exec(params))) {
          parts.push((p[1] || '').toLowerCase());
        }
        if (parts.length) ctorMap.set(cls, parts);
      }
      while ((c = newCallRegex.exec(code))) {
        const cls = c[1];
        const args = c[2] || '';
        const argParts = args.split(',').map(s => s.trim());
        if (ctorMap.has(cls)) {
          const expected = ctorMap.get(cls)!;
          for (let i = 0; i < Math.min(expected.length, argParts.length); i++) {
            const expectedType = expected[i];
            const arg = argParts[i];
            const ln = lineOf(c.index);
            const argIsString = /^['"`].*['"`]$/.test(arg);
            const argIsNumber = /^\d/.test(arg);
            if ((expectedType === 'string' && argIsNumber) || (expectedType === 'number' && argIsString)) {
              issues.push({ type: 'error', message: `Constructor argument ${i+1} type mismatch for ${cls} (expected ${expectedType})`, line: ln, ruleId: 'ts-constructor-arg-type', suggestion: `Pass a ${expectedType} for parameter ${i+1} when constructing ${cls}.`, range: { startLine: ln } });
            }
          }
        }
      }
    } catch (e) {
      console.debug('validateTs heuristics failed', e);
    }

    // TypeScript compiler diagnostics are disabled for now to avoid bundling node-only modules
    // The heuristics above provide basic TypeScript validation without requiring the full compiler
    return issues;
  }

  async validateJs(code: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Heuristic: redeclaration of variables
    const varRegex = /\b(?:let|var|const)\s+([A-Za-z_$][\w$]*)/g;
    const names = new Map<string, number[]>();
    let m: RegExpExecArray | null;
    const lineOf = (idx: number) => code.slice(0, idx).split(/\r?\n/).length;
    while ((m = varRegex.exec(code))) {
      const name = m[1];
      const ln = lineOf(m.index);
      if (!names.has(name)) names.set(name, []);
      names.get(name)!.push(ln);
    }
    for (const [n, arr] of names.entries()) {
      if (arr.length > 1) {
        for (const ln of arr) {
          issues.push({ type: 'error', message: `Redeclaration of variable '${n}'`, line: ln, ruleId: 'js-redeclare', suggestion: `Remove duplicate declaration of ${n}.`, range: { startLine: ln } });
        }
      }
    }

    // Assignment inside condition (common bug: if (a = "") )
    const assignIfRegex = /if\s*\([^)]*=[^=][^)]*\)/g;
    while ((m = assignIfRegex.exec(code))) {
      const ln = lineOf(m.index);
      issues.push({ type: 'error', message: 'Assignment inside conditional (use ==/=== for comparison)', line: ln, ruleId: 'js-assign-in-if', suggestion: 'Use comparison operator (== or ===) instead of assignment.', range: { startLine: ln } });
    }

    // Missing curly braces after if/for/while (best-effort)
    const noBraceIf = /if\s*\([^)]*\)\s*[^\s{\n]/g;
    while ((m = noBraceIf.exec(code))) {
      const ln = lineOf(m.index);
      issues.push({ type: 'warning', message: 'Missing curly braces for control statement', line: ln, ruleId: 'js-missing-braces', suggestion: 'Wrap the consequent in { } to avoid accidental bugs.', range: { startLine: ln } });
    }

    // Duplicate entries in array literals (simple detection)
    const arrayLit = /=\s*\[([^\]]+)\]/g;
    while ((m = arrayLit.exec(code))) {
      const content = m[1];
      const parts = content.split(',').map(s => s.trim());
      const seen = new Map<string, number[]>();
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (!seen.has(p)) seen.set(p, []);
        seen.get(p)!.push(i + 1);
      }
      for (const [val, idxs] of seen.entries()) {
        if (idxs.length > 1) {
          const ln = lineOf(m.index);
          issues.push({ type: 'warning', message: `Duplicate array entry '${val}'`, line: ln, ruleId: 'js-duplicate-array-entry', suggestion: 'Remove duplicate values from array.', range: { startLine: ln } });
        }
      }
    }

    return issues;
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