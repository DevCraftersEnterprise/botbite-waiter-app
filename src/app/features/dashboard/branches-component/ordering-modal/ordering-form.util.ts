import {
  Ordering,
  OrderingScheduling,
  OrderingType,
  UpdateOrdering,
} from '../../../../core/services/types/ordering.types';
import { formatCoordinates, parseCoordinates } from '../../../../shared/utils/coordinates.util';
import { HoursForm, hoursProblems } from '../../../../shared/utils/hours.util';
import { isTime } from '../../../../shared/utils/time.util';

// El horario es igual en el mesero y en pedidos: vive en shared/utils/hours.util.
export { DAYS, emptyHours, toggleDay } from '../../../../shared/utils/hours.util';
export type { HoursForm } from '../../../../shared/utils/hours.util';

export const DEFAULT_SCHEDULING: OrderingScheduling = {
  enabled: false,
  maxDays: 1,
  minLeadMinutes: 45,
  stepMinutes: 30,
  reminderMinutes: 30,
  cancelUntilMinutes: 60,
};

export interface ZoneForm {
  name: string;
  /** Latitud y longitud en un solo campo, como las copia Google Maps. */
  coordinates: string;
  radiusMeters: number;
  days: number[];
  /** Vacíos los dos: todo el día. */
  from: string;
  to: string;
}

export interface OrderingForm {
  enabled: boolean;
  accepting: boolean;
  phoneNumberId: string;
  phoneNumber: string;
  pickup: boolean;
  delivery: boolean;
  baseFee: number;
  includedKm: number;
  extraPer100m: number;
  /** Vacío: sin límite. */
  maxKm: string;
  zones: ZoneForm[];
  hours: HoursForm[];
  scheduling: OrderingScheduling;
  commissionPct: number;
  paymentLinkMinutes: number;
  prepMinutes: number;
}

export const emptyZone = (): ZoneForm => ({
  name: '',
  coordinates: '',
  radiusMeters: 500,
  days: [],
  from: '',
  to: '',
});

/** Sin pedidos configurados, el formulario sale con los valores por defecto de la API. */
export const toOrderingForm = (ordering: Ordering | null): OrderingForm => ({
  enabled: ordering?.enabled ?? false,
  accepting: ordering?.accepting ?? true,
  phoneNumberId: ordering?.phoneNumberId ?? '',
  phoneNumber: ordering?.phoneNumber ?? '',
  pickup: ordering ? ordering.types.includes('pickup') : true,
  delivery: ordering ? ordering.types.includes('delivery') : true,
  baseFee: ordering?.delivery.baseFee ?? 0,
  includedKm: ordering?.delivery.includedKm ?? 0,
  extraPer100m: ordering?.delivery.extraPer100m ?? 0,
  maxKm: ordering?.delivery.maxKm == null ? '' : String(ordering.delivery.maxKm),
  zones: (ordering?.noDeliveryZones ?? []).map((zone) => ({
    name: zone.name,
    coordinates: formatCoordinates(zone.latitude, zone.longitude),
    radiusMeters: zone.radiusMeters,
    days: [...zone.days],
    from: zone.from ?? '',
    to: zone.to ?? '',
  })),
  hours: (ordering?.hours ?? []).map((window) => ({ ...window, days: [...window.days] })),
  scheduling: { ...DEFAULT_SCHEDULING, ...ordering?.scheduling },
  commissionPct: ordering?.commissionPct ?? 0,
  paymentLinkMinutes: ordering?.paymentLinkMinutes ?? 60,
  prepMinutes: ordering?.prepMinutes ?? 20,
});

/** El teléfono va como lo muestra WhatsApp: solo dígitos, con lada. */
export const cleanPhone = (phone: string): string => phone.replace(/[\s()+-]/g, '');

const zoneLabel = (zone: ZoneForm, index: number): string =>
  zone.name.trim() ? `La zona "${zone.name.trim()}"` : `La zona ${index + 1}`;

/** Lo que impide guardar, en español. Vacío: se puede guardar. */
export const orderingProblems = (form: OrderingForm): string[] => {
  const problems: string[] = [];
  const phone = cleanPhone(form.phoneNumber);

  if (!form.pickup && !form.delivery) {
    problems.push('Elige al menos un tipo de pedido: recoger o domicilio.');
  }
  if (form.enabled && (!form.phoneNumberId.trim() || !phone)) {
    problems.push(
      'Para activar los pedidos captura el phone number ID y el teléfono del número de pedidos.'
    );
  }
  if (phone && !/^\d{8,15}$/.test(phone)) {
    problems.push('El teléfono de pedidos debe tener de 8 a 15 dígitos, con lada.');
  }
  if (form.phoneNumberId.trim() && !/^\d{5,30}$/.test(form.phoneNumberId.trim())) {
    problems.push('El phone number ID de pedidos lleva solo números.');
  }
  if (form.maxKm.trim() && !(Number(form.maxKm) > 0)) {
    problems.push('La distancia máxima debe ser mayor que 0, o quedar vacía para no tener límite.');
  }

  form.zones.forEach((zone, index) => {
    const label = zoneLabel(zone, index);
    const coordinates = parseCoordinates(zone.coordinates);
    if (!zone.name.trim()) problems.push(`La zona ${index + 1} necesita un nombre.`);
    if (!coordinates || coordinates === 'invalid') {
      problems.push(`${label} necesita coordenadas (latitud, longitud).`);
    }
    if (!(zone.radiusMeters >= 10)) problems.push(`${label} necesita un radio de al menos 10 m.`);
    if (Boolean(zone.from) !== Boolean(zone.to) || (zone.from && zone.from === zone.to)) {
      problems.push(`${label} necesita hora de inicio y de fin distintas, o ninguna.`);
    } else if ((zone.from && !isTime(zone.from)) || (zone.to && !isTime(zone.to))) {
      problems.push(`${label} necesita las horas en formato de 24 horas, como 21:00.`);
    }
  });

  problems.push(...hoursProblems(form.hours, (index) => `El horario ${index + 1}`));

  return problems;
};

/** Lo que se manda a la API. Activarlo, el número y la comisión solo los manda un admin. */
export const toOrderingChanges = (form: OrderingForm, isAdmin: boolean): UpdateOrdering => {
  const types: OrderingType[] = [
    ...(form.pickup ? (['pickup'] as const) : []),
    ...(form.delivery ? (['delivery'] as const) : []),
  ];

  const changes: UpdateOrdering = {
    accepting: form.accepting,
    types,
    delivery: {
      baseFee: form.baseFee,
      includedKm: form.includedKm,
      extraPer100m: form.extraPer100m,
      maxKm: form.maxKm.trim() ? Number(form.maxKm) : null,
    },
    noDeliveryZones: form.zones.map((zone) => {
      const coordinates = parseCoordinates(zone.coordinates);
      const point = coordinates && coordinates !== 'invalid' ? coordinates : null;
      return {
        name: zone.name.trim(),
        latitude: point?.latitude ?? 0,
        longitude: point?.longitude ?? 0,
        radiusMeters: zone.radiusMeters,
        days: [...zone.days],
        from: zone.from || null,
        to: zone.to || null,
      };
    }),
    hours: form.hours.map((window) => ({
      days: [...window.days],
      opens: window.opens,
      closes: window.closes,
    })),
    scheduling: { ...form.scheduling },
    paymentLinkMinutes: form.paymentLinkMinutes,
    prepMinutes: form.prepMinutes,
  };

  if (!isAdmin) return changes;

  return {
    ...changes,
    enabled: form.enabled,
    phoneNumberId: form.phoneNumberId.trim() || null,
    phoneNumber: cleanPhone(form.phoneNumber) || null,
    commissionPct: form.commissionPct,
  };
};

/** Para revisar una zona en el mapa antes de guardarla. */
export const zoneMapUrl = (zone: ZoneForm): string | null => {
  const coordinates = parseCoordinates(zone.coordinates);
  return coordinates && coordinates !== 'invalid'
    ? `https://www.google.com/maps/search/?api=1&query=${coordinates.latitude},${coordinates.longitude}`
    : null;
};
