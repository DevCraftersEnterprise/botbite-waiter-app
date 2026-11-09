import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { finalize } from 'rxjs';
import { MenusService } from '../../../../core/services/menus.service';
import {
  MenuImportAction,
  MenuImportErrorBody,
  MenuImportIssue,
  MenuImportPreview,
} from '../../../../core/services/types/menu-csv.types';
import { ModalComponent } from '../../../../shared/components/modal/modal';
import { actionLabel, columnLabel, issueLocation, summaryText } from './menu-csv.util';

const ACTION_CLASSES: Record<MenuImportAction, string> = {
  create: 'border-green-200 bg-green-100 text-green-800',
  add: 'border-blue-200 bg-blue-100 text-blue-800',
  update: 'border-black/10 bg-neutral-100 text-neutral-700',
};

/**
 * Importa el menú de la sucursal desde un CSV: primero muestra la vista previa
 * de la API y solo guarda cuando el archivo no tiene errores y se confirma.
 */
@Component({
  selector: 'app-menu-csv-import',
  imports: [ModalComponent, CurrencyPipe],
  templateUrl: './menu-csv-import.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuCsvImportComponent {
  readonly menuId = input.required<string>();
  readonly isOpen = input.required<boolean>();
  readonly closed = output<void>();
  readonly imported = output<void>();

  private readonly menusService = inject(MenusService);
  private readonly toastr = inject(ToastrService);

  protected readonly file = signal<File | null>(null);
  protected readonly preview = signal<MenuImportPreview | null>(null);
  protected readonly photoErrors = signal<MenuImportIssue[]>([]);
  protected readonly checking = signal(false);
  protected readonly saving = signal(false);
  /** Ya se importó, pero hay fotos que no se copiaron: se muestran antes de cerrar. */
  protected readonly finished = signal(false);

  protected readonly errors = computed(() => this.preview()?.errors ?? []);
  protected readonly warnings = computed(() => this.preview()?.warnings ?? []);
  protected readonly canImport = computed(() => {
    const preview = this.preview();
    return !!preview && !preview.errors.length && preview.rows.length > 0;
  });
  protected readonly confirmText = computed(() => (this.finished() ? 'Cerrar' : 'Importar'));

  protected readonly columnLabel = columnLabel;
  protected readonly actionLabel = actionLabel;
  protected readonly issueLocation = issueLocation;
  protected readonly summaryText = summaryText;

  protected actionClass(action: MenuImportAction): string {
    return ACTION_CLASSES[action];
  }

  protected onFileSelected(event: Event): void {
    const fileInput = event.target as HTMLInputElement;
    const file = fileInput.files?.[0];
    // Permite volver a elegir el mismo archivo después de corregirlo.
    fileInput.value = '';
    if (!file) return;

    this.file.set(file);
    this.preview.set(null);
    this.photoErrors.set([]);
    this.finished.set(false);
    this.checking.set(true);

    this.menusService
      .previewMenuCsv(this.menuId(), file)
      .pipe(finalize(() => this.checking.set(false)))
      .subscribe({
        next: (preview) => this.preview.set(preview),
        error: (error: HttpErrorResponse) => {
          this.file.set(null);
          this.toastr.error(this.errorMessage(error, 'No se pudo leer el archivo'));
        },
      });
  }

  protected confirm(): void {
    if (this.finished()) {
      this.close();
      return;
    }

    const file = this.file();
    if (!file || !this.canImport()) return;

    this.saving.set(true);
    this.menusService
      .importMenuCsv(this.menuId(), file)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (result) => {
          this.toastr.success(result.message);
          this.imported.emit();

          if (result.photoErrors.length) {
            this.photoErrors.set(result.photoErrors);
            this.finished.set(true);
          } else {
            this.reset();
          }
        },
        error: (error: HttpErrorResponse) => {
          const body = error.error as MenuImportErrorBody | null;

          // El menú cambió entre la vista previa y la importación.
          if (error.status === 400 && body?.errors) {
            this.preview.update((preview) =>
              preview
                ? { ...preview, errors: body.errors ?? [], warnings: body.warnings ?? [] }
                : preview
            );
          }
          this.toastr.error(this.errorMessage(error, 'No se pudo importar el menú'));
        },
      });
  }

  /** Cerrar a mano no interrumpe una importación en curso. */
  protected close(): void {
    if (!this.saving()) this.reset();
  }

  private reset(): void {
    this.file.set(null);
    this.preview.set(null);
    this.photoErrors.set([]);
    this.finished.set(false);
    this.closed.emit();
  }

  private errorMessage(error: HttpErrorResponse, fallback: string): string {
    const message = (error.error as { message?: unknown } | null)?.message;
    return typeof message === 'string' ? message : fallback;
  }
}
