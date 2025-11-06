import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
// css-tree is loaded dynamically at runtime to avoid build-time module resolution
// errors in environments where the package isn't installed.
// diff-match-patch will be loaded dynamically inside diffText to avoid build-time
// import errors in environments where the package or its types aren't installed.
import { CssDuplicate } from '../interfaces/validation.interface';

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
}