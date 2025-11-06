import { ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';

// Use CDN-hosted Monaco to ensure editor assets are available during development
const monacoConfig = {
  // When `/assets/monaco` is not populated, load Monaco from CDN so the editor renders.
  baseUrl: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.39.0/min/vs',
  defaultOptions: { automaticLayout: true, fontSize: 14 },
};

export const appConfig: ApplicationConfig = {
  providers: [provideZoneChangeDetection({ eventCoalescing: true }), provideRouter(routes), provideClientHydration(withEventReplay()), importProvidersFrom(MonacoEditorModule.forRoot(monacoConfig))]
};
