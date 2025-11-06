import { Routes } from '@angular/router';
import { ShellLayoutComponent } from './shared/components/shell-layout.component';
import { ValidatePageComponent } from './features/validate/validate-page.component';
import { CompareCssPageComponent } from './features/compare-css/compare-css-page.component';
import { ReportPageComponent } from './features/report/report-page.component';
import { QualityDashboardComponent } from './features/quality/quality-dashboard.component';

export const routes: Routes = [
  {
    path: '',
    component: ShellLayoutComponent,
    children: [
      {
        path: '',
        redirectTo: 'validate',
        pathMatch: 'full'
      },
      { path: 'validate', component: ValidatePageComponent },
      { path: 'compare-css', component: CompareCssPageComponent },
      { path: 'report', component: ReportPageComponent },
      { path: 'quality', component: QualityDashboardComponent }
    ]
  }
];
