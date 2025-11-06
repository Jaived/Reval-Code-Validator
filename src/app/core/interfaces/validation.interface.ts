export type IssueType = 'error' | 'warning' | 'info';

export interface Range {
  startLine: number;
  startColumn?: number;
  endLine?: number;
  endColumn?: number;
}

export interface QuickFix {
  title: string;
  // minimal edit: replace range with newText
  edit: { range: Range; newText: string };
  confidence?: 'high' | 'medium' | 'low';
  isSafe?: boolean;
}

export interface ValidationIssue {
  id?: string;
  type: IssueType;
  severity?: 'major' | 'minor' | 'info';
  message: string;
  line: number;
  column?: number;
  ruleId?: string;
  suggestion?: string;
  range?: Range;
  fix?: QuickFix;
}

export interface CssDuplicate {
  selector: string;
  declarationsA: string[];
  declarationsB: string[];
  hasConflict: boolean;
}

export interface ValidationReport {
  language: string;
  timestamp: string;
  issues: ValidationIssue[];
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
}