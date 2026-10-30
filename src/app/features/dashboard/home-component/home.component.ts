import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { LucideAngularModule, LucideIconData } from 'lucide-angular';
import { ToastrService } from 'ngx-toastr';
import { catchError, finalize, of } from 'rxjs';
import { BranchesService } from '../../../core/services/branches.service';
import { IconsService } from '../../../core/services/icons.service';
import { OrdersService } from '../../../core/services/orders.service';
import { OrgService } from '../../../core/services/org.service';
import { Branch } from '../../../core/services/types/branches.types';
import { Order } from '../../../core/services/types/orders.type';
import { todayYYYYMMDD } from '../../../shared/utils/date.utils';
import { ModalComponent } from '../../../shared/components/modal/modal';

interface MetricCard {
  label: string;
  value: string | number;
  icon?: LucideIconData;
}

@Component({
  selector: 'app-home',
  imports: [CommonModule, LucideAngularModule, ModalComponent],
  templateUrl: './home.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  protected readonly orgService = inject(OrgService);
  private readonly ordersService = inject(OrdersService);
  private readonly branchesService = inject(BranchesService);
  private readonly toastrService = inject(ToastrService);
  protected readonly iconsService = inject(IconsService);

  protected readonly loadingToday = signal<boolean>(false);
  protected readonly generatingQr = signal<boolean>(false);
  protected readonly downloadingQr = signal<boolean>(false);
  protected readonly showQrModal = signal<boolean>(false);
  protected readonly qrCustomText = signal<string>('');

  private readonly todayCount = signal<number>(0);
  protected readonly branchQrUrl = signal<string>('');

  protected readonly metrics = computed<MetricCard[]>(() => [
    {
      label: 'Órdenes totales',
      value: this.todayCount(),
      icon: this.iconsService.orders,
    },
  ]);

  constructor() {
    effect(() => {
      const branchId = this.orgService.selectedBranchId();

      if (!branchId) {
        this.resetMetrics();
        this.branchQrUrl.set('');
        return;
      }

      // Resetear métricas antes de cargar nuevos datos al cambiar de sucursal
      this.resetMetrics();

      this.fetchToday(branchId);
      this.branchQrUrl.set(this.orgService.selectedBranch()?.qrUrl ?? '');
    });
  }

  private fetchToday(branchId: string): void {
    this.loadingToday.set(true);

    const date = todayYYYYMMDD();
    this.ordersService
      .getAll({ branchId, date })
      .pipe(
        catchError(() => {
          this.resetMetrics();
          return of([]);
        }),
        finalize(() => this.loadingToday.set(false))
      )
      .subscribe((orders) => {
        this.updateMetrics(orders);
      });
  }

  private updateMetrics(orders: Order[]): void {
    this.todayCount.set(orders.length);
  }

  private resetMetrics(): void {
    this.todayCount.set(0);
  }

  generateBranchQr(): void {
    const { restaurantId, branchId } = this.getSelectedIds();

    if (!this.validateSelection(restaurantId, branchId) || this.generatingQr()) {
      return;
    }

    this.generatingQr.set(true);

    this.branchesService
      .generateQr(branchId!)
      .pipe(
        catchError(() => {
          this.toastrService.error('Error al generar el QR');
          return of({ qrUrl: '' });
        }),
        finalize(() => this.generatingQr.set(false))
      )
      .subscribe(({ qrUrl }) => {
        this.handleQrGenerated(qrUrl);
      });
  }

  private getSelectedIds(): { restaurantId: string | null; branchId: string | null } {
    return {
      restaurantId: this.orgService.selectedRestaurantId(),
      branchId: this.orgService.selectedBranchId(),
    };
  }

  private validateSelection(restaurantId: string | null, branchId: string | null): boolean {
    if (!restaurantId) {
      this.toastrService.warning('Necesitas tener un restaurante para generar el QR');
      return false;
    }

    if (!branchId) {
      this.toastrService.warning('Necesitas tener una sucursal para generar el QR');
      return false;
    }

    return true;
  }

  private handleQrGenerated(qrUrl: string): void {
    if (qrUrl) {
      this.orgService.updateSelectedBranch({ qrUrl });
      this.toastrService.success('QR generado correctamente');
    } else {
      this.toastrService.warning('Se generó el QR pero no se recibió la URL');
    }
  }

  async downloadBranchQr(): Promise<void> {
    const url = this.branchQrUrl();
    const branch = this.orgService.selectedBranch();

    if (!url || !branch) return;

    // Abrir modal para personalizar el QR
    this.showQrModal.set(true);
  }

  protected closeQrModal(): void {
    this.showQrModal.set(false);
    this.qrCustomText.set('');
  }

  protected updateQrText(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.qrCustomText.set(input.value);
  }

  protected async confirmDownloadQr(): Promise<void> {
    const url = this.branchQrUrl();
    const branch = this.orgService.selectedBranch();
    const customText = this.qrCustomText().trim();

    if (!url || !branch) return;

    this.downloadingQr.set(true);
    this.closeQrModal();

    try {
      if (customText) {
        await this.downloadQrWithText(url, branch, customText);
      } else {
        await this.downloadQrDirectly(url, branch);
      }
      this.toastrService.success('Descarga iniciada');
    } catch {
      this.handleDownloadFallback(url);
    } finally {
      this.downloadingQr.set(false);
    }
  }

  private async downloadQrWithText(url: string, branch: Branch, text: string): Promise<void> {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const blob = await response.blob();
    const imageUrl = URL.createObjectURL(blob);

    // Crear canvas para combinar QR + texto
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');

    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = imageUrl;
    });

    // Configurar tamaño del canvas (texto + QR + padding)
    const padding = 40;
    const textHeight = 80;
    canvas.width = img.width + padding * 2;
    canvas.height = img.height + padding * 2 + textHeight;

    // Fondo blanco
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dibujar texto en la parte superior (más centrado)
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, textHeight / 2 + padding);

    // Dibujar QR debajo del texto
    ctx.drawImage(img, padding, textHeight + padding);

    // Convertir canvas a blob y descargar
    canvas.toBlob((finalBlob) => {
      if (finalBlob) {
        const filename = this.generateQrFilename(branch, finalBlob);
        this.triggerDownload(finalBlob, filename);
      }
    }, 'image/png');

    URL.revokeObjectURL(imageUrl);
  }

  private async downloadQrDirectly(url: string, branch: Branch): Promise<void> {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const blob = await response.blob();
    const filename = this.generateQrFilename(branch, blob);

    this.triggerDownload(blob, filename);
  }

  private generateQrFilename(branch: Branch, blob: Blob): string {
    const ext = (blob.type?.split('/')?.[1] || 'png').replace('+xml', '');
    const sanitizedName = branch.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    return `qr-${sanitizedName}.${ext}`;
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(objectUrl);
  }

  private handleDownloadFallback(url: string): void {
    this.toastrService.info('No se pudo descargar automáticamente. Abriendo en nueva pestaña.');
    window.open(url, '_blank');
  }
}
