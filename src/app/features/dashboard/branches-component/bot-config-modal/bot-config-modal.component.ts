import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ToastrService } from 'ngx-toastr';
import { catchError, EMPTY, finalize } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { BotService } from '../../../../core/services/bot.service';
import { IconsService } from '../../../../core/services/icons.service';
import { Branch } from '../../../../core/services/types/branches.types';
import {
  BotConfig,
  BotFeatures,
  BotKey,
  UpdateBotConfig,
} from '../../../../core/services/types/bot.types';
import { ModalComponent } from '../../../../shared/components/modal/modal';

interface BotConfigForm {
  slug: string;
  whatsappPhoneNumberId: string;
  botBaseUrl: string;
  latitude: string;
  longitude: string;
  verifyLocation: boolean;
  geofenceMeters: number;
  qrCodeMinutes: number;
  validTables: string;
  sessionHours: number;
  postSaleHours: number;
  maxRecommendations: number;
  timezone: string;
  dailyCloseTime: string;
  surveyUrl: string;
  features: BotFeatures;
}

type TextField =
  | 'slug'
  | 'whatsappPhoneNumberId'
  | 'botBaseUrl'
  | 'latitude'
  | 'longitude'
  | 'validTables'
  | 'timezone'
  | 'dailyCloseTime'
  | 'surveyUrl';

type NumberField =
  | 'geofenceMeters'
  | 'qrCodeMinutes'
  | 'sessionHours'
  | 'postSaleHours'
  | 'maxRecommendations';

const FEATURES: { key: keyof BotFeatures; label: string }[] = [
  { key: 'interactiveMenu', label: 'Menú interactivo' },
  { key: 'pdfMenu', label: 'Menú en PDF' },
  { key: 'recommendations', label: 'Recomendaciones' },
  { key: 'wallet', label: 'Monedero' },
  { key: 'mercadoPago', label: 'Pago con Mercado Pago' },
  { key: 'invoicing', label: 'Facturación' },
  { key: 'promotions', label: 'Promociones' },
  { key: 'survey', label: 'Encuesta' },
];

const toForm = (config: BotConfig): BotConfigForm => ({
  slug: config.slug,
  whatsappPhoneNumberId: config.whatsappPhoneNumberId ?? '',
  botBaseUrl: config.botBaseUrl ?? '',
  latitude: config.latitude?.toString() ?? '',
  longitude: config.longitude?.toString() ?? '',
  verifyLocation: config.verifyLocation,
  geofenceMeters: config.geofenceMeters,
  qrCodeMinutes: config.qrCodeMinutes,
  validTables: config.validTables.join(', '),
  sessionHours: config.sessionHours,
  postSaleHours: config.postSaleHours,
  maxRecommendations: config.maxRecommendations,
  timezone: config.timezone,
  dailyCloseTime: config.dailyCloseTime,
  surveyUrl: config.surveyUrl ?? '',
  features: config.features,
});

const toCoordinate = (value: string): number | null =>
  value.trim() === '' ? null : Number(value);

@Component({
  selector: 'app-bot-config-modal',
  imports: [DatePipe, LucideAngularModule, ModalComponent],
  templateUrl: './bot-config-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BotConfigModalComponent {
  private readonly botService = inject(BotService);
  private readonly authService = inject(AuthService);
  private readonly toastrService = inject(ToastrService);
  protected readonly iconsService = inject(IconsService);

  /** Sucursal a configurar; null mantiene el modal cerrado. */
  readonly branch = input<Branch | null>(null);
  readonly closed = output<void>();
  /** Se guardó: el slug pudo cambiar y con él el QR. */
  readonly saved = output<void>();

  protected readonly features = FEATURES;

  protected readonly form = signal<BotConfigForm | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);

  protected readonly keys = signal<BotKey[]>([]);
  protected readonly newKeyName = signal('');
  protected readonly creatingKey = signal(false);
  protected readonly revokingKeyId = signal<string | null>(null);
  /** Llave recién creada: es la única vez que se puede ver completa. */
  protected readonly createdSecret = signal<string | null>(null);

  /** La conexión con n8n, las funciones y las llaves las administra BotBite. */
  protected readonly isAdmin = computed(() => {
    const roles = this.authService.user()?.roles || [];
    return roles.includes('super') || roles.includes('admin');
  });

  protected readonly coordinatesMissing = computed(() => {
    const f = this.form();
    return !!f && f.verifyLocation && (!f.latitude.trim() || !f.longitude.trim());
  });

  protected readonly coordinatesInvalid = computed(() => {
    const f = this.form();
    if (!f) return false;
    const invalid = (value: string, limit: number) => {
      if (value.trim() === '') return false;
      const number = Number(value);
      return Number.isNaN(number) || Math.abs(number) > limit;
    };
    return invalid(f.latitude, 90) || invalid(f.longitude, 180);
  });

  protected readonly canSave = computed(
    () =>
      !!this.form() &&
      !this.loading() &&
      !this.coordinatesMissing() &&
      !this.coordinatesInvalid()
  );

  constructor() {
    effect(() => {
      const branch = this.branch();

      this.form.set(null);
      this.keys.set([]);
      this.createdSecret.set(null);
      this.newKeyName.set('');

      if (branch) this.load(branch.id);
    });
  }

  private load(branchId: string): void {
    this.loading.set(true);

    this.botService
      .getConfig(branchId)
      .pipe(
        catchError((e) => {
          console.error('Error loading bot config:', e);
          this.toastrService.error('No se pudo cargar la configuración del mesero');
          this.closed.emit();
          return EMPTY;
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe((config) => this.form.set(toForm(config)));

    if (this.isAdmin()) this.loadKeys(branchId);
  }

  private loadKeys(branchId: string): void {
    this.botService
      .listKeys(branchId)
      .pipe(
        catchError((e) => {
          console.error('Error loading bot keys:', e);
          this.toastrService.error('No se pudieron cargar las llaves');
          return EMPTY;
        })
      )
      .subscribe((keys) => this.keys.set(keys));
  }

  protected updateText(key: TextField, ev: Event): void {
    const { value } = ev.target as HTMLInputElement;
    this.patchForm({ [key]: value });
  }

  protected updateNumber(key: NumberField, ev: Event): void {
    const { value } = ev.target as HTMLInputElement;
    this.patchForm({ [key]: Number(value) });
  }

  protected updateVerifyLocation(ev: Event): void {
    this.patchForm({ verifyLocation: (ev.target as HTMLInputElement).checked });
  }

  protected updateFeature(key: keyof BotFeatures, ev: Event): void {
    const { checked } = ev.target as HTMLInputElement;
    const current = this.form();
    if (current) this.patchForm({ features: { ...current.features, [key]: checked } });
  }

  private patchForm(changes: Partial<BotConfigForm>): void {
    this.form.update((f) => (f ? { ...f, ...changes } : f));
  }

  protected save(): void {
    const branch = this.branch();
    const f = this.form();

    if (!branch || !f || !this.canSave()) return;

    this.saving.set(true);

    this.botService
      .updateConfig(branch.id, this.toChanges(f))
      .pipe(
        catchError((e) => {
          console.error('Error saving bot config:', e);
          this.toastrService.error(
            e?.status === 409
              ? 'El slug o el phone_number_id ya lo usa otra sucursal'
              : 'No se pudo guardar. Revisa los datos.'
          );
          return EMPTY;
        }),
        finalize(() => this.saving.set(false))
      )
      .subscribe(() => {
        this.toastrService.success('Configuración guardada');
        this.saved.emit();
        this.closed.emit();
      });
  }

  private toChanges(f: BotConfigForm): UpdateBotConfig {
    const changes: UpdateBotConfig = {
      latitude: toCoordinate(f.latitude),
      longitude: toCoordinate(f.longitude),
      verifyLocation: f.verifyLocation,
      geofenceMeters: f.geofenceMeters,
      qrCodeMinutes: f.qrCodeMinutes,
      validTables: f.validTables.split(','),
      sessionHours: f.sessionHours,
      postSaleHours: f.postSaleHours,
      maxRecommendations: f.maxRecommendations,
      timezone: f.timezone.trim(),
      dailyCloseTime: f.dailyCloseTime,
      surveyUrl: f.surveyUrl.trim() || null,
    };

    if (!this.isAdmin()) return changes;

    return {
      ...changes,
      slug: f.slug.trim(),
      whatsappPhoneNumberId: f.whatsappPhoneNumberId.trim() || null,
      botBaseUrl: f.botBaseUrl.trim() || null,
      features: f.features,
    };
  }

  protected updateNewKeyName(ev: Event): void {
    this.newKeyName.set((ev.target as HTMLInputElement).value);
  }

  protected createKey(): void {
    const branch = this.branch();
    const name = this.newKeyName().trim();

    if (!branch || !name) return;

    this.creatingKey.set(true);

    this.botService
      .createKey(branch.id, name)
      .pipe(
        catchError((e) => {
          console.error('Error creating bot key:', e);
          this.toastrService.error('No se pudo generar la llave');
          return EMPTY;
        }),
        finalize(() => this.creatingKey.set(false))
      )
      .subscribe(({ key, secret }) => {
        this.keys.update((keys) => [key, ...keys]);
        this.createdSecret.set(secret);
        this.newKeyName.set('');
      });
  }

  protected copySecret(): void {
    const secret = this.createdSecret();
    if (!secret) return;

    navigator.clipboard
      .writeText(secret)
      .then(() => this.toastrService.success('Llave copiada'))
      .catch(() => this.toastrService.error('No se pudo copiar. Selecciónala a mano.'));
  }

  protected revokeKey(key: BotKey): void {
    const branch = this.branch();
    if (!branch) return;

    this.revokingKeyId.set(key.id);

    this.botService
      .revokeKey(branch.id, key.id)
      .pipe(
        catchError((e) => {
          console.error('Error revoking bot key:', e);
          this.toastrService.error('No se pudo revocar la llave');
          return EMPTY;
        }),
        finalize(() => this.revokingKeyId.set(null))
      )
      .subscribe(() => {
        this.toastrService.success(`Llave "${key.name}" revocada`);
        this.loadKeys(branch.id);
      });
  }

  protected close(): void {
    this.closed.emit();
  }
}
