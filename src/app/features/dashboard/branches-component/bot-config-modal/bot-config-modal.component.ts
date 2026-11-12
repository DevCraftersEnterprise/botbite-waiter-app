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
import { environment } from '../../../../../environments/environment';
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
import { HoursEditorComponent } from '../../../../shared/components/hours-editor/hours-editor';
import {
  LocationMapComponent,
  MapPoint,
} from '../../../../shared/components/location-map/location-map';
import { ModalComponent } from '../../../../shared/components/modal/modal';
import { TimeInputComponent } from '../../../../shared/components/time-input/time-input';
import {
  FieldErrors,
  formErrorSummary,
  toFormErrors,
} from '../../../../shared/utils/api-errors.util';
import { formatCoordinates, parseCoordinates } from '../../../../shared/utils/coordinates.util';
import { HoursForm, hoursProblems } from '../../../../shared/utils/hours.util';
import { isTime } from '../../../../shared/utils/time.util';
import { timezoneLabel } from '../../../../shared/utils/timezones.util';
import { logError } from '../../../../core/services/error-log';

interface BotConfigForm {
  /** Lo que va después del prefijo del restaurante. */
  slugSuffix: string;
  whatsappPhoneNumberId: string;
  botBaseUrl: string;
  /** Latitud y longitud en un solo campo, como las copia Google Maps. */
  coordinates: string;
  verifyLocation: boolean;
  geofenceMeters: number;
  qrCodeMinutes: number;
  validTables: string;
  sessionHours: number;
  postSaleHours: number;
  maxRecommendations: number;
  /** "Cierre del día": no es el horario del mesero. */
  dailyCloseTime: string;
  /** Horario del mesero. Vacío: atiende siempre. */
  hours: HoursForm[];
  /** Comisión de BotBite en los pagos del mesero. Solo la cambia un admin. */
  commissionPct: number;
  surveyUrl: string;
  features: BotFeatures;
}

type TextField =
  | 'slugSuffix'
  | 'whatsappPhoneNumberId'
  | 'botBaseUrl'
  | 'coordinates'
  | 'validTables'
  | 'dailyCloseTime'
  | 'surveyUrl';

type NumberField =
  | 'geofenceMeters'
  | 'qrCodeMinutes'
  | 'sessionHours'
  | 'postSaleHours'
  | 'maxRecommendations'
  | 'commissionPct';

/** Campos que la API puede rechazar; los errores se muestran junto a ellos. */
const API_FIELDS = [
  'slug',
  'whatsappPhoneNumberId',
  'botBaseUrl',
  'latitude',
  'longitude',
  'geofenceMeters',
  'qrCodeMinutes',
  'validTables',
  'sessionHours',
  'postSaleHours',
  'maxRecommendations',
  'dailyCloseTime',
  'hours',
  'commissionPct',
  'surveyUrl',
] as const;

/** Qué campo del formulario muestra el error de cada campo de la API. */
const FORM_FIELD: Partial<Record<(typeof API_FIELDS)[number], TextField | NumberField | 'hours'>> = {
  slug: 'slugSuffix',
  latitude: 'coordinates',
  longitude: 'coordinates',
};

const FEATURES: { key: keyof BotFeatures; label: string }[] = [
  { key: 'interactiveMenu', label: 'Menú interactivo' },
  { key: 'pdfMenu', label: 'Menú en PDF' },
  { key: 'recommendations', label: 'Recomendaciones' },
  { key: 'wallet', label: 'Monedero' },
  { key: 'mercadoPago', label: 'Pago con Mercado Pago' },
  { key: 'invoicing', label: 'Facturación' },
  { key: 'promotions', label: 'Promociones' },
  { key: 'survey', label: 'Encuesta' },
  { key: 'languages', label: 'Idiomas (apagado: solo en español)' },
];

/** El prefijo del restaurante es fijo: solo se edita lo que sigue. */
export const splitSlug = (slug: string, restaurantSlug: string | null) =>
  restaurantSlug && slug.startsWith(`${restaurantSlug}-`)
    ? slug.slice(restaurantSlug.length + 1)
    : slug;

export const joinSlug = (suffix: string, restaurantSlug: string | null) => {
  const clean = suffix.trim().replace(/^-+/, '');
  return restaurantSlug ? `${restaurantSlug}-${clean}` : clean;
};

const toForm = (config: BotConfig, restaurantSlug: string | null): BotConfigForm => ({
  slugSuffix: splitSlug(config.slug, restaurantSlug),
  whatsappPhoneNumberId: config.whatsappPhoneNumberId ?? '',
  botBaseUrl: config.botBaseUrl ?? '',
  coordinates: formatCoordinates(config.latitude, config.longitude),
  verifyLocation: config.verifyLocation,
  geofenceMeters: config.geofenceMeters,
  qrCodeMinutes: config.qrCodeMinutes,
  validTables: config.validTables.join(', '),
  sessionHours: config.sessionHours,
  postSaleHours: config.postSaleHours,
  maxRecommendations: config.maxRecommendations,
  dailyCloseTime: config.dailyCloseTime,
  hours: (config.hours ?? []).map((window) => ({ ...window, days: [...window.days] })),
  commissionPct: config.commissionPct ?? 0,
  surveyUrl: config.surveyUrl ?? '',
  features: config.features,
});

@Component({
  selector: 'app-bot-config-modal',
  imports: [
    DatePipe,
    HoursEditorComponent,
    LocationMapComponent,
    LucideAngularModule,
    ModalComponent,
    TimeInputComponent,
  ],
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
  /** Se cambia en los datos de la sucursal: aquí solo se muestra. */
  protected readonly timezone = signal('');
  /** El slug como está guardado: solo se manda si cambia. */
  private readonly savedSlug = signal('');
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly fieldErrors = signal<FieldErrors>({});

  protected readonly keys = signal<BotKey[]>([]);
  protected readonly newKeyName = signal('');
  protected readonly creatingKey = signal(false);
  protected readonly revokingKeyId = signal<string | null>(null);
  /** Llave recién creada: es la única vez que se puede ver completa. */
  protected readonly createdSecret = signal<string | null>(null);
  protected readonly secretCopied = signal(false);
  /** Se quiso cerrar con una llave sin copiar: se pide confirmación. */
  protected readonly confirmLeave = signal(false);

  /** La conexión con el servicio del mesero, las funciones y las llaves las administra BotBite. */
  protected readonly isAdmin = computed(() => {
    const roles = this.authService.user()?.roles || [];
    return roles.includes('super') || roles.includes('admin');
  });

  protected readonly restaurantSlug = computed(() => this.branch()?.restaurant?.slug ?? null);

  protected readonly slug = computed(() => {
    const f = this.form();
    return f ? joinSlug(f.slugSuffix, this.restaurantSlug()) : '';
  });

  /** URL base que espera el servicio del mesero: el dominio del bot más el slug. */
  protected readonly suggestedBaseUrl = computed(() => `${environment.botUrl}/m/${this.slug()}`);

  protected readonly parsedCoordinates = computed(() => {
    const f = this.form();
    return f ? parseCoordinates(f.coordinates) : null;
  });

  protected readonly coordinatesMissing = computed(() => {
    const f = this.form();
    return !!f && f.verifyLocation && this.parsedCoordinates() === null;
  });

  protected readonly coordinatesInvalid = computed(() => this.parsedCoordinates() === 'invalid');

  /** El punto del mapa: solo con coordenadas que se entienden. */
  protected readonly mapPoint = computed(() => {
    const coordinates = this.parsedCoordinates();
    return coordinates && coordinates !== 'invalid' ? coordinates : null;
  });

  protected readonly timezoneName = computed(() => timezoneLabel(this.timezone()));

  /** Lo que impide guardar el horario o el cierre del día, en español. */
  protected readonly timeProblems = computed(() => {
    const f = this.form();
    if (!f) return [];
    return [
      ...(isTime(f.dailyCloseTime)
        ? []
        : ['El cierre del día necesita una hora en formato de 24 horas, como 23:30.']),
      ...hoursProblems(f.hours, (index) => `El horario ${index + 1}`),
    ];
  });

  protected readonly canSave = computed(() => {
    const f = this.form();
    return (
      !!f &&
      !this.loading() &&
      this.timeProblems().length === 0 &&
      !!f.slugSuffix.trim() &&
      !this.coordinatesMissing() &&
      !this.coordinatesInvalid()
    );
  });

  constructor() {
    effect(() => {
      const branch = this.branch();

      this.form.set(null);
      this.keys.set([]);
      this.createdSecret.set(null);
      this.secretCopied.set(false);
      this.confirmLeave.set(false);
      this.fieldErrors.set({});
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
          logError('Error loading bot config:', e);
          this.toastrService.error('No se pudo cargar la configuración del mesero');
          this.closed.emit();
          return EMPTY;
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe((config) => {
        this.savedSlug.set(config.slug);
        this.timezone.set(config.timezone);
        this.form.set(toForm(config, this.restaurantSlug()));
      });

    if (this.isAdmin()) this.loadKeys(branchId);
  }

  private loadKeys(branchId: string): void {
    this.botService
      .listKeys(branchId)
      .pipe(
        catchError((e) => {
          logError('Error loading bot keys:', e);
          this.toastrService.error('No se pudieron cargar las llaves');
          return EMPTY;
        })
      )
      .subscribe((keys) => this.keys.set(keys));
  }

  protected errorOf(field: TextField | NumberField | 'hours'): string | null {
    return this.fieldErrors()[field] ?? null;
  }

  /** Borde rojo en el campo que rechazó la API. */
  protected invalidClass(field: TextField | NumberField): string {
    return this.errorOf(field) ? 'border-red-500 bg-red-50/40' : '';
  }

  protected updateText(key: TextField, ev: Event): void {
    const { value } = ev.target as HTMLInputElement;
    this.patchForm({ [key]: value }, key);
  }

  protected updateNumber(key: NumberField, ev: Event): void {
    const { value } = ev.target as HTMLInputElement;
    this.patchForm({ [key]: Number(value) }, key);
  }

  /** Un clic en el mapa llena las coordenadas, igual que si se pegaran. */
  protected setCoordinates(point: MapPoint): void {
    this.patchForm(
      { coordinates: formatCoordinates(point.latitude, point.longitude) },
      'coordinates'
    );
  }

  protected updateDailyClose(value: string): void {
    this.patchForm({ dailyCloseTime: value }, 'dailyCloseTime');
  }

  protected updateHours(hours: HoursForm[]): void {
    this.patchForm({ hours }, 'hours');
  }

  protected updateVerifyLocation(ev: Event): void {
    this.patchForm({ verifyLocation: (ev.target as HTMLInputElement).checked }, 'coordinates');
  }

  protected useSuggestedBaseUrl(): void {
    this.patchForm({ botBaseUrl: this.suggestedBaseUrl() }, 'botBaseUrl');
  }

  protected updateFeature(key: keyof BotFeatures, ev: Event): void {
    const { checked } = ev.target as HTMLInputElement;
    const current = this.form();
    if (current) this.patchForm({ features: { ...current.features, [key]: checked } });
  }

  private patchForm(
    changes: Partial<BotConfigForm>,
    field?: TextField | NumberField | 'hours'
  ): void {
    this.form.update((f) => (f ? { ...f, ...changes } : f));
    if (field && this.fieldErrors()[field]) {
      this.fieldErrors.update((errors) => {
        const next = { ...errors };
        delete next[field];
        return next;
      });
    }
  }

  protected save(): void {
    const branch = this.branch();
    const f = this.form();

    if (!branch || !f || !this.canSave()) return;

    this.saving.set(true);
    this.fieldErrors.set({});

    this.botService
      .updateConfig(branch.id, this.toChanges(f))
      .pipe(
        catchError((e) => {
          logError('Error saving bot config:', e);
          const errors = toFormErrors(e, API_FIELDS);
          const byFormField: FieldErrors = {};
          for (const [field, message] of Object.entries(errors.fields)) {
            const formField = FORM_FIELD[field as (typeof API_FIELDS)[number]] ?? field;
            byFormField[formField] ??= message;
          }
          this.fieldErrors.set(byFormField);
          this.toastrService.error(formErrorSummary(errors));
          return EMPTY;
        }),
        finalize(() => this.saving.set(false))
      )
      .subscribe(() => {
        this.toastrService.success('Configuración guardada');
        this.savedSlug.set(this.slug());
        this.saved.emit();
        this.close();
      });
  }

  private toChanges(f: BotConfigForm): UpdateBotConfig {
    const coordinates = this.parsedCoordinates();
    const located = coordinates && coordinates !== 'invalid' ? coordinates : null;

    const changes: UpdateBotConfig = {
      latitude: located?.latitude ?? null,
      longitude: located?.longitude ?? null,
      verifyLocation: f.verifyLocation,
      geofenceMeters: f.geofenceMeters,
      qrCodeMinutes: f.qrCodeMinutes,
      validTables: f.validTables.split(','),
      sessionHours: f.sessionHours,
      postSaleHours: f.postSaleHours,
      maxRecommendations: f.maxRecommendations,
      dailyCloseTime: f.dailyCloseTime,
      hours: f.hours.map((window) => ({
        days: [...window.days],
        opens: window.opens,
        closes: window.closes,
      })),
      surveyUrl: f.surveyUrl.trim() || null,
    };

    if (!this.isAdmin()) return changes;

    const slug = this.slug();
    return {
      ...changes,
      // Solo si cambia: los slugs anteriores al estándar se guardan tal cual.
      ...(slug !== this.savedSlug() ? { slug } : {}),
      whatsappPhoneNumberId: f.whatsappPhoneNumberId.trim() || null,
      botBaseUrl: f.botBaseUrl.trim() || null,
      features: f.features,
      commissionPct: f.commissionPct,
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
          logError('Error creating bot key:', e);
          this.toastrService.error('No se pudo generar la llave');
          return EMPTY;
        }),
        finalize(() => this.creatingKey.set(false))
      )
      .subscribe(({ key, secret }) => {
        this.keys.update((keys) => [key, ...keys]);
        this.createdSecret.set(secret);
        this.secretCopied.set(false);
        this.newKeyName.set('');
      });
  }

  protected copySecret(): void {
    const secret = this.createdSecret();
    if (!secret) return;

    navigator.clipboard
      .writeText(secret)
      .then(() => {
        this.secretCopied.set(true);
        this.toastrService.success('Llave copiada');
      })
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
          logError('Error revoking bot key:', e);
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

  /** Con una llave nueva sin copiar, primero se confirma: no se vuelve a mostrar. */
  protected close(): void {
    if (this.createdSecret() && !this.secretCopied()) {
      this.confirmLeave.set(true);
      return;
    }
    this.closed.emit();
  }

  protected leaveWithoutCopying(): void {
    this.secretCopied.set(true);
    this.closed.emit();
  }
}
