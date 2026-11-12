import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ToastrService } from 'ngx-toastr';
import { catchError, EMPTY, finalize } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { BotService } from '../../../../core/services/bot.service';
import { IconsService } from '../../../../core/services/icons.service';
import { Branch } from '../../../../core/services/types/branches.types';
import { OrderingScheduling } from '../../../../core/services/types/ordering.types';
import { HoursEditorComponent } from '../../../../shared/components/hours-editor/hours-editor';
import {
  LocationMapComponent,
  MapPoint,
} from '../../../../shared/components/location-map/location-map';
import { ModalComponent } from '../../../../shared/components/modal/modal';
import { TimeInputComponent } from '../../../../shared/components/time-input/time-input';
import { formatCoordinates, parseCoordinates } from '../../../../shared/utils/coordinates.util';
import {
  FieldErrors,
  formErrorSummary,
  toFormErrors,
} from '../../../../shared/utils/api-errors.util';
import {
  DAYS,
  emptyZone,
  HoursForm,
  OrderingForm,
  orderingProblems,
  toggleDay,
  toOrderingChanges,
  toOrderingForm,
  ZoneForm,
  zoneMapUrl,
} from './ordering-form.util';
import { logError } from '../../../../core/services/error-log';

type TextField = 'phoneNumberId' | 'phoneNumber' | 'maxKm';
type NumberField =
  | 'baseFee'
  | 'includedKm'
  | 'extraPer100m'
  | 'commissionPct'
  | 'paymentLinkMinutes'
  | 'prepMinutes';
type FlagField = 'enabled' | 'accepting' | 'pickup' | 'delivery';

/** Campos de la API cuyos errores se muestran junto a su sección. */
const API_FIELDS = [
  'phoneNumberId',
  'phoneNumber',
  'commissionPct',
  'types',
  'delivery',
  'noDeliveryZones',
  'hours',
  'scheduling',
  'paymentLinkMinutes',
  'prepMinutes',
] as const;

/** Ajustes del número de pedidos (recoger y domicilio) de una sucursal. */
@Component({
  selector: 'app-ordering-modal',
  imports: [
    HoursEditorComponent,
    LocationMapComponent,
    LucideAngularModule,
    ModalComponent,
    TimeInputComponent,
  ],
  templateUrl: './ordering-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderingModalComponent {
  private readonly botService = inject(BotService);
  private readonly authService = inject(AuthService);
  private readonly toastrService = inject(ToastrService);
  protected readonly iconsService = inject(IconsService);

  /** Sucursal a configurar; null mantiene el modal cerrado. */
  readonly branch = input<Branch | null>(null);
  readonly closed = output<void>();

  protected readonly days = DAYS;
  protected readonly form = signal<OrderingForm | null>(null);
  /** La sucursal nunca configuró pedidos. */
  protected readonly isNew = signal(false);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly fieldErrors = signal<FieldErrors>({});

  /** Activar pedidos, su número y la comisión los administra BotBite. */
  protected readonly isAdmin = computed(() => {
    const roles = this.authService.user()?.roles || [];
    return roles.includes('super') || roles.includes('admin');
  });

  protected readonly problems = computed(() => {
    const f = this.form();
    return f ? orderingProblems(f) : [];
  });

  protected readonly canSave = computed(
    () => !!this.form() && !this.loading() && this.problems().length === 0
  );

  constructor() {
    effect(() => {
      const branch = this.branch();

      untracked(() => {
        this.form.set(null);
        this.fieldErrors.set({});
        if (branch) this.load(branch.id);
      });
    });
  }

  private load(branchId: string): void {
    this.loading.set(true);

    this.botService
      .getOrdering(branchId)
      .pipe(
        catchError((e) => {
          logError('Error loading ordering:', e);
          this.toastrService.error('No se pudieron cargar los ajustes de pedidos');
          this.closed.emit();
          return EMPTY;
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe((ordering) => {
        this.isNew.set(ordering === null);
        this.form.set(toOrderingForm(ordering));
      });
  }

  protected errorOf(field: (typeof API_FIELDS)[number]): string | null {
    return this.fieldErrors()[field] ?? null;
  }

  private patch(changes: Partial<OrderingForm>): void {
    this.form.update((f) => (f ? { ...f, ...changes } : f));
  }

  protected updateText(key: TextField, ev: Event): void {
    this.patch({ [key]: (ev.target as HTMLInputElement).value });
  }

  protected updateNumber(key: NumberField, ev: Event): void {
    this.patch({ [key]: Number((ev.target as HTMLInputElement).value) });
  }

  protected updateFlag(key: FlagField, ev: Event): void {
    this.patch({ [key]: (ev.target as HTMLInputElement).checked });
  }

  protected updateScheduling(key: keyof OrderingScheduling, ev: Event): void {
    const target = ev.target as HTMLInputElement;
    const value = key === 'enabled' ? target.checked : Number(target.value);
    const f = this.form();
    if (f) this.patch({ scheduling: { ...f.scheduling, [key]: value } });
  }

  // Zonas sin entrega

  protected addZone(): void {
    const f = this.form();
    if (f) this.patch({ zones: [...f.zones, emptyZone()] });
  }

  protected removeZone(index: number): void {
    this.zoneMapOpen.set(null);
    const f = this.form();
    if (f) this.patch({ zones: f.zones.filter((_, i) => i !== index) });
  }

  private patchZone(index: number, changes: Partial<ZoneForm>): void {
    const f = this.form();
    if (!f) return;
    this.patch({
      zones: f.zones.map((zone, i) => (i === index ? { ...zone, ...changes } : zone)),
    });
  }

  protected updateZoneText(index: number, key: 'name' | 'coordinates', ev: Event): void {
    this.patchZone(index, { [key]: (ev.target as HTMLInputElement).value });
  }

  protected updateZoneTime(index: number, key: 'from' | 'to', value: string): void {
    this.patchZone(index, { [key]: value });
  }

  protected updateZoneRadius(index: number, ev: Event): void {
    this.patchZone(index, { radiusMeters: Number((ev.target as HTMLInputElement).value) });
  }

  protected toggleZoneDay(index: number, day: number): void {
    const zone = this.form()?.zones[index];
    if (zone) this.patchZone(index, { days: toggleDay(zone.days, day) });
  }

  protected mapUrl(zone: ZoneForm): string | null {
    return zoneMapUrl(zone);
  }

  /** La zona cuyo mapa está abierto: uno a la vez, para no cargar varios. */
  protected readonly zoneMapOpen = signal<number | null>(null);

  /** La sucursal, como referencia en el mapa de cada zona. */
  protected readonly branchPoint = computed((): MapPoint | null => {
    const branch = this.branch();
    const latitude = branch?.latitude == null ? NaN : Number(branch.latitude);
    const longitude = branch?.longitude == null ? NaN : Number(branch.longitude);
    return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
  });

  protected zonePoint(zone: ZoneForm): MapPoint | null {
    const coordinates = parseCoordinates(zone.coordinates);
    return coordinates && coordinates !== 'invalid' ? coordinates : null;
  }

  protected toggleZoneMap(index: number): void {
    this.zoneMapOpen.update((open) => (open === index ? null : index));
  }

  /** Un clic en el mapa llena el centro de la zona. */
  protected setZoneCenter(index: number, point: MapPoint): void {
    this.patchZone(index, { coordinates: formatCoordinates(point.latitude, point.longitude) });
  }

  // Horario

  protected updateHours(hours: HoursForm[]): void {
    this.patch({ hours });
  }

  protected save(): void {
    const branch = this.branch();
    const f = this.form();

    if (!branch || !f || !this.canSave()) return;

    this.saving.set(true);
    this.fieldErrors.set({});

    this.botService
      .updateOrdering(branch.id, toOrderingChanges(f, this.isAdmin()))
      .pipe(
        catchError((e) => {
          logError('Error saving ordering:', e);
          const errors = toFormErrors(e, API_FIELDS);
          this.fieldErrors.set(errors.fields);
          this.toastrService.error(formErrorSummary(errors));
          return EMPTY;
        }),
        finalize(() => this.saving.set(false))
      )
      .subscribe(() => {
        this.toastrService.success('Ajustes de pedidos guardados');
        this.closed.emit();
      });
  }

  protected close(): void {
    this.closed.emit();
  }
}
