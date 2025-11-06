import { Injectable } from '@angular/core';
import { ValidationReport } from '../interfaces/validation.interface';
// We load heavy client-side libraries dynamically at runtime to avoid build-time
// errors when types or packages are not present in the dev environment.

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  constructor() {}

  async exportPdf(containerElement: HTMLElement): Promise<void> {
    try {
      // dynamic import to avoid build-time dependency issues
      const html2canvasModule: any = await import('html2canvas');
      const html2canvas = html2canvasModule.default ?? html2canvasModule;

      const jspdfModule: any = await import('jspdf');
      const jsPDF = jspdfModule.jsPDF ?? jspdfModule.default ?? jspdfModule;

      // call html2canvas (cast to any due to differing types across versions)
      const canvas: any = await (html2canvas as any)(containerElement, {
        scale: 2,
        useCORS: true,
        logging: false
      } as any);

      const imgData = canvas.toDataURL('image/png');
      const pdf: any = new jsPDF({
        orientation: 'portrait',
        unit: 'mm'
      });

      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('reval-code-validator-report.pdf');
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error;
    }
  }

  async exportJson(report: ValidationReport): Promise<void> {
    try {
      const blob = new Blob([JSON.stringify(report, null, 2)], {
        type: 'application/json'
      });

      const fileSaver: any = await import('file-saver');
      const saveAs = fileSaver.saveAs ?? fileSaver.default ?? fileSaver;
      saveAs(blob, 'reval-code-validator-report.json');
    } catch (error) {
      console.error('Error exporting JSON:', error);
      throw error;
    }
  }
}