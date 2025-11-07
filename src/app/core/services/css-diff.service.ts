import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
// css-tree is loaded dynamically at runtime to avoid build-time module resolution
// errors in environments where the package isn't installed.
// diff-match-patch will be loaded dynamically inside diffText to avoid build-time
// import errors in environments where the package or its types aren't installed.
import { CssDuplicate } from '../interfaces/validation.interface';

export interface CodeDuplicate {
  type: 'selector' | 'id' | 'function' | 'class' | 'variable';
  name: string;
  leftCode: string;
  rightCode: string;
  hasConflict: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CssDiffService {
  private lastComparisonSubject = new BehaviorSubject<CssDuplicate[]>([]);
  lastComparison$ = this.lastComparisonSubject.asObservable();

  constructor() {}

  private async normalizeDeclarations(rule: any): Promise<string[]> {
    const declarations: string[] = [];
    let cssTree: any = null;
    try {
      cssTree = await import('css-tree');
    } catch (e) {
      // css-tree not available; return empty declarations and let caller handle
      return declarations;
    }

    cssTree.walk(rule, {
      visit: 'Declaration',
      enter: (node: any) => {
        declarations.push(`${node.property}: ${cssTree.generate(node.value)}`);
      }
    });
    return declarations.sort();
  }

  async findDuplicateSelectors(cssA: string, cssB: string): Promise<CssDuplicate[]> {
    const duplicates: CssDuplicate[] = [];
    const selectorsA = new Map<string, string[]>();
    const selectorsB = new Map<string, string[]>();

    try {
      // Load css-tree dynamically
      let cssTree: any = null;
      try {
        cssTree = await import('css-tree');
      } catch (e) {
        console.warn('css-tree not available; CSS comparison will be skipped.');
        return [];
      }

      // Parse both CSS files
      const astA = cssTree.parse(cssA);
      const astB = cssTree.parse(cssB);

      // Build selector maps
      cssTree.walk(astA, {
        visit: 'Rule',
        enter: (node: any) => {
          const selector = cssTree.generate(node.prelude);
          // normalizeDeclarations is async now
          selectorsA.set(selector, []);
        }
      });

      cssTree.walk(astB, {
        visit: 'Rule',
        enter: (node: any) => {
          const selector = cssTree.generate(node.prelude);
          selectorsB.set(selector, []);
        }
      });

      // Now fill declarations by walking again (so we can await normalizeDeclarations)
      cssTree.walk(astA, {
        visit: 'Rule',
        enter: (node: any) => {
          const selector = cssTree.generate(node.prelude);
          // kick off normalizeDeclarations but don't await here
          // we'll await later when comparing
          selectorsA.set(selector, null as unknown as string[]);
          // attach raw node for later processing
          (selectorsA as any).set.__node__ = (selectorsA as any).set.__node__ || {};
          (selectorsA as any).set.__node__[selector] = node;
        }
      });

      cssTree.walk(astB, {
        visit: 'Rule',
        enter: (node: any) => {
          const selector = cssTree.generate(node.prelude);
          (selectorsB as any).set = (selectorsB as any).set || {};
          (selectorsB as any).set.__node__ = (selectorsB as any).set.__node__ || {};
          (selectorsB as any).set.__node__[selector] = node;
        }
      });

      // Find duplicates and conflicts
      // Build declarations arrays (await normalizeDeclarations where needed)
      const finalDuplicates: CssDuplicate[] = [];
      for (const [selector, _] of selectorsA) {
        if (!selectorsB.has(selector)) continue;
        const nodeA = (selectorsA as any).set?.__node__?.[selector];
        const nodeB = (selectorsB as any).set?.__node__?.[selector];
        const declarationsA = nodeA ? await this.normalizeDeclarations(nodeA) : [];
        const declarationsB = nodeB ? await this.normalizeDeclarations(nodeB) : [];
        const hasConflict = !this.areDeclarationsEqual(declarationsA, declarationsB);
        finalDuplicates.push({ selector, declarationsA, declarationsB, hasConflict });
      }

      // use finalDuplicates below
      finalDuplicates.forEach(d => duplicates.push(d));

    } catch (error) {
      console.error('Error comparing CSS:', error);
    }

    this.lastComparisonSubject.next(duplicates);
    return duplicates;
  }

  private areDeclarationsEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  // Perform a text diff using diff-match-patch if available. This function
  // attempts to require/import the library at runtime so builds don't fail
  // if types or the package are missing in some environments.
  diffText(left: string, right: string): any[] {
    let dmp: any = null;

    // Try global (if script included) or window
    try {
      dmp = (globalThis as any).diff_match_patch || (window as any).diff_match_patch;
    } catch (e) {
      // ignore
    }

    if (!dmp) {
      try {
        // Use require where available (bundlers will handle this)
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const req: any = (typeof require !== 'undefined') ? require : null;
        const pkg = req ? req('diff-match-patch') : null;
        dmp = pkg && (pkg.diff_match_patch || pkg);
      } catch (e) {
        // library not available
        dmp = null;
      }
    }

    // Fallback simple diff if dmp not available
    if (!dmp) {
      if (left === right) return [];
      return [[0, left], [0, right]];
    }

    // If dmp is a constructor, instantiate it
    const dmpInstance = (typeof dmp === 'function') ? new dmp() : dmp;
    const diff = dmpInstance.diff_main(left, right);
    if (typeof dmpInstance.diff_cleanupSemantic === 'function') {
      dmpInstance.diff_cleanupSemantic(diff);
    }
    return diff;
  }

  // Find duplicate IDs and classes in HTML
  findHtmlDuplicates(htmlA: string, htmlB: string): CodeDuplicate[] {
    const duplicates: CodeDuplicate[] = [];

    // Extract IDs from both HTML files
    const idsA = this.extractHtmlIds(htmlA);
    const idsB = this.extractHtmlIds(htmlB);

    // Find common IDs
    for (const [id, codeA] of idsA.entries()) {
      if (idsB.has(id)) {
        const codeB = idsB.get(id)!;
        duplicates.push({
          type: 'id',
          name: id,
          leftCode: codeA,
          rightCode: codeB,
          hasConflict: codeA !== codeB
        });
      }
    }

    return duplicates;
  }

  private extractHtmlIds(html: string): Map<string, string> {
    const ids = new Map<string, string>();
    const idRegex = /\bid\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi;
    let match: RegExpExecArray | null;

    while ((match = idRegex.exec(html))) {
      const id = (match[1] || match[2] || match[3] || '').trim();
      if (id) {
        // Extract the full element containing this id
        const start = Math.max(0, match.index - 50);
        const end = Math.min(html.length, match.index + 100);
        const context = html.substring(start, end).trim();
        ids.set(id, context);
      }
    }

    return ids;
  }

  // Find duplicate functions and variables in JavaScript
  findJsDuplicates(jsA: string, jsB: string): CodeDuplicate[] {
    const duplicates: CodeDuplicate[] = [];

    // Extract functions and variables
    const functionsA = this.extractJsFunctions(jsA);
    const functionsB = this.extractJsFunctions(jsB);
    const variablesA = this.extractJsVariables(jsA);
    const variablesB = this.extractJsVariables(jsB);

    // Find common functions
    for (const [name, codeA] of functionsA.entries()) {
      if (functionsB.has(name)) {
        const codeB = functionsB.get(name)!;
        duplicates.push({
          type: 'function',
          name,
          leftCode: codeA,
          rightCode: codeB,
          hasConflict: this.normalizeWhitespace(codeA) !== this.normalizeWhitespace(codeB)
        });
      }
    }

    // Find common variables
    for (const [name, codeA] of variablesA.entries()) {
      if (variablesB.has(name)) {
        const codeB = variablesB.get(name)!;
        duplicates.push({
          type: 'variable',
          name,
          leftCode: codeA,
          rightCode: codeB,
          hasConflict: this.normalizeWhitespace(codeA) !== this.normalizeWhitespace(codeB)
        });
      }
    }

    return duplicates;
  }

  private extractJsFunctions(code: string): Map<string, string> {
    const functions = new Map<string, string>();

    // Match function declarations and expressions
    const functionRegex = /function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g;
    const arrowFunctionRegex = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g;

    let match: RegExpExecArray | null;

    while ((match = functionRegex.exec(code))) {
      const name = match[1];
      const start = match.index;
      // Try to find the end of the function (simple brace matching)
      const end = this.findClosingBrace(code, start + match[0].length - 1);
      if (end > start) {
        functions.set(name, code.substring(start, end + 1).trim());
      }
    }

    while ((match = arrowFunctionRegex.exec(code))) {
      const name = match[1];
      const start = match.index;
      // Find end of arrow function
      const arrowPos = code.indexOf('=>', start);
      if (arrowPos > 0) {
        const afterArrow = code.substring(arrowPos + 2).trim();
        if (afterArrow.startsWith('{')) {
          const end = this.findClosingBrace(code, arrowPos + 2);
          if (end > start) {
            functions.set(name, code.substring(start, end + 1).trim());
          }
        } else {
          // Single expression arrow function
          const end = code.indexOf(';', arrowPos);
          if (end > 0) {
            functions.set(name, code.substring(start, end + 1).trim());
          }
        }
      }
    }

    return functions;
  }

  private extractJsVariables(code: string): Map<string, string> {
    const variables = new Map<string, string>();
    const variableRegex = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;]+);/g;
    let match: RegExpExecArray | null;

    while ((match = variableRegex.exec(code))) {
      const name = match[1];
      // Skip if it's an arrow function (already captured)
      if (!match[2].includes('=>')) {
        variables.set(name, match[0].trim());
      }
    }

    return variables;
  }

  // Find duplicate classes, interfaces, and functions in TypeScript
  findTsDuplicates(tsA: string, tsB: string): CodeDuplicate[] {
    const duplicates: CodeDuplicate[] = [];

    // Extract classes, interfaces, and functions
    const classesA = this.extractTsClasses(tsA);
    const classesB = this.extractTsClasses(tsB);
    const functionsA = this.extractJsFunctions(tsA); // TS functions are like JS
    const functionsB = this.extractJsFunctions(tsB);

    // Find common classes
    for (const [name, codeA] of classesA.entries()) {
      if (classesB.has(name)) {
        const codeB = classesB.get(name)!;
        duplicates.push({
          type: 'class',
          name,
          leftCode: codeA,
          rightCode: codeB,
          hasConflict: this.normalizeWhitespace(codeA) !== this.normalizeWhitespace(codeB)
        });
      }
    }

    // Find common functions
    for (const [name, codeA] of functionsA.entries()) {
      if (functionsB.has(name)) {
        const codeB = functionsB.get(name)!;
        duplicates.push({
          type: 'function',
          name,
          leftCode: codeA,
          rightCode: codeB,
          hasConflict: this.normalizeWhitespace(codeA) !== this.normalizeWhitespace(codeB)
        });
      }
    }

    return duplicates;
  }

  private extractTsClasses(code: string): Map<string, string> {
    const classes = new Map<string, string>();
    const classRegex = /(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/g;
    let match: RegExpExecArray | null;

    while ((match = classRegex.exec(code))) {
      const name = match[1];
      const start = match.index;
      // Find the opening brace
      const openBrace = code.indexOf('{', start);
      if (openBrace > 0) {
        const end = this.findClosingBrace(code, openBrace);
        if (end > start) {
          classes.set(name, code.substring(start, end + 1).trim());
        }
      }
    }

    return classes;
  }

  private findClosingBrace(code: string, startPos: number): number {
    let depth = 1;
    for (let i = startPos + 1; i < code.length; i++) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}') {
        depth--;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  private normalizeWhitespace(code: string): string {
    return code.replace(/\s+/g, ' ').trim();
  }
}