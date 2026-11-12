import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { PdfViewerModule } from 'ng2-pdf-viewer';
import { IconsService } from '../../../core/services/icons.service';
import { safeDecode, toSafePdfUrl } from './menu-pdf-url.util';
import { logError } from '../../../core/services/error-log';

@Component({
  selector: 'app-menu-viewer',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, PdfViewerModule],
  templateUrl: './menu-viewer.component.html',
})
export class MenuViewerComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  protected readonly iconsService = inject(IconsService);

  readonly loading = signal(true);
  readonly error = signal(false);
  /** Siempre una URL validada con `toSafePdfUrl`, o vacía. */
  readonly pdfUrl = signal<string>('');
  readonly menuName = signal<string>('Menú');
  readonly pdfLoadError = signal(false);

  ngOnInit() {
    // La ruta es pública y la URL del PDF viene en el enlace: se valida antes de usarla.
    const pdfUrl = toSafePdfUrl(this.route.snapshot.queryParamMap.get('url'));
    const name = this.route.snapshot.queryParamMap.get('name');

    if (!pdfUrl) {
      this.error.set(true);
      this.loading.set(false);
      return;
    }

    this.pdfUrl.set(pdfUrl);
    if (name) {
      // Como antes, decodifica una vez más; con un % suelto se queda tal cual.
      this.menuName.set(safeDecode(name));
    }
    this.loading.set(false);
  }

  async downloadPdf() {
    // Nunca se usa algo que no haya pasado la validación (ni `javascript:` ni otro dominio).
    const url = toSafePdfUrl(this.pdfUrl());
    if (!url) return;

    const fileName = `${this.menuName()}.pdf`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();

      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;

      link.click();

      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100);
    } catch (error) {
      logError('Error al descargar el PDF:', error);
      // Si no se pudo bajar, se abre el PDF de Cloudinary en otra pestaña.
      window.open(url, '_blank', 'noopener');
    }
  }

  onPdfError() {
    this.pdfLoadError.set(true);
  }
}
