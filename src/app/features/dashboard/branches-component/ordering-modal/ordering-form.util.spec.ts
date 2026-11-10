import { Ordering } from '../../../../core/services/types/ordering.types';
import {
  emptyHours,
  emptyZone,
  orderingProblems,
  toggleDay,
  toOrderingChanges,
  toOrderingForm,
  zoneMapUrl,
} from './ordering-form.util';

describe('ordering form', () => {
  const ordering: Ordering = {
    enabled: true,
    accepting: false,
    phoneNumberId: '777000111222',
    phoneNumber: '5216441110000',
    types: ['delivery'],
    delivery: { baseFee: 30, includedKm: 4, extraPer100m: 1, maxKm: null },
    noDeliveryZones: [
      {
        name: 'Colonia X',
        latitude: 27.52,
        longitude: -109.94,
        radiusMeters: 500,
        days: [5, 6],
        from: '21:00',
        to: '06:00',
      },
    ],
    hours: [{ days: [1, 2, 3], opens: '18:00', closes: '23:00' }],
    scheduling: {
      enabled: true,
      maxDays: 2,
      minLeadMinutes: 45,
      stepMinutes: 30,
      reminderMinutes: 30,
      cancelUntilMinutes: 60,
    },
    commissionPct: 0.5,
    paymentLinkMinutes: 60,
    prepMinutes: 20,
  };

  it('starts with the API defaults when the branch never had ordering', () => {
    const form = toOrderingForm(null);
    expect(form).toEqual(
      jasmine.objectContaining({
        enabled: false,
        accepting: true,
        pickup: true,
        delivery: true,
        maxKm: '',
        zones: [],
        hours: [],
        paymentLinkMinutes: 60,
        prepMinutes: 20,
      })
    );
    expect(form.scheduling.maxDays).toBe(1);
    expect(orderingProblems(form)).toEqual([]);
  });

  it('round-trips the settings, with zones as pasted coordinates', () => {
    const form = toOrderingForm(ordering);
    expect(form.pickup).toBeFalse();
    expect(form.zones[0].coordinates).toBe('27.52, -109.94');

    const changes = toOrderingChanges(form, true);
    expect(changes).toEqual(
      jasmine.objectContaining({
        enabled: true,
        accepting: false,
        types: ['delivery'],
        phoneNumber: '5216441110000',
        commissionPct: 0.5,
        noDeliveryZones: ordering.noDeliveryZones,
        hours: ordering.hours,
        scheduling: ordering.scheduling,
      })
    );
    expect(changes.delivery).toEqual(ordering.delivery);
  });

  it('only lets an admin send activation, the number and the commission', () => {
    const changes = toOrderingChanges(toOrderingForm(ordering), false);
    for (const field of ['enabled', 'phoneNumberId', 'phoneNumber', 'commissionPct']) {
      expect(field in changes)
        .withContext(field)
        .toBeFalse();
    }
  });

  it('keeps the phone as WhatsApp shows it and an empty limit as no limit', () => {
    const form = {
      ...toOrderingForm(ordering),
      phoneNumber: '+52 1 644 111 0000',
      maxKm: ' ',
    };
    const changes = toOrderingChanges(form, true);
    expect(changes.phoneNumber).toBe('5216441110000');
    expect(changes.delivery?.maxKm).toBeNull();
  });

  it('explains what blocks saving', () => {
    const form = {
      ...toOrderingForm(ordering),
      pickup: false,
      delivery: false,
      phoneNumber: '123',
      maxKm: 'mucho',
      zones: [{ ...emptyZone(), coordinates: 'aquí', from: '21:00' }],
      hours: [{ ...emptyHours(), days: [], opens: '18:00', closes: '18:00' }],
    };

    expect(orderingProblems(form)).toEqual([
      'Elige al menos un tipo de pedido: recoger o domicilio.',
      'El teléfono de pedidos debe tener de 8 a 15 dígitos, con lada.',
      'La distancia máxima debe ser mayor que 0, o quedar vacía para no tener límite.',
      'La zona 1 necesita un nombre.',
      'La zona 1 necesita coordenadas (latitud, longitud).',
      'La zona 1 necesita hora de inicio y de fin distintas, o ninguna.',
      'El horario 1 necesita al menos un día.',
      'El horario 1 necesita apertura y cierre distintos.',
    ]);
  });

  it('asks for the number before enabling ordering', () => {
    const form = { ...toOrderingForm(null), enabled: true };
    expect(orderingProblems(form)).toContain(
      'Para activar los pedidos captura el phone number ID y el teléfono del número de pedidos.'
    );
  });

  it('links a zone to the map and toggles days', () => {
    expect(zoneMapUrl({ ...emptyZone(), coordinates: '27.52, -109.94' })).toBe(
      'https://www.google.com/maps/search/?api=1&query=27.52,-109.94'
    );
    expect(zoneMapUrl(emptyZone())).toBeNull();
    expect(toggleDay([1, 2], 2)).toEqual([1]);
    expect(toggleDay([1], 0)).toEqual([1, 0]);
  });
});
