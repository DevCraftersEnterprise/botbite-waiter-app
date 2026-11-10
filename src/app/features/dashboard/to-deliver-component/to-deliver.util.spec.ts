import { DeliveryOrder } from '../../../core/services/types/orders.type';
import { deliveryMapUrl, formatScheduled, groupByStatus, nextSteps } from './to-deliver.util';

describe('to deliver utils', () => {
  it('offers the cashier the same buttons as in WhatsApp', () => {
    expect(nextSteps({ type: 'delivery', fulfillmentStatus: 'pending' })).toEqual([
      { status: 'preparing', label: 'Preparar' },
      { status: 'on_the_way', label: 'Va en camino' },
    ]);
    expect(nextSteps({ type: 'pickup', fulfillmentStatus: 'preparing' })).toEqual([
      { status: 'ready', label: 'Ya está listo' },
    ]);
    expect(nextSteps({ type: 'pickup', fulfillmentStatus: 'ready' })).toEqual([
      { status: 'delivered', label: 'Entregado' },
    ]);
    expect(nextSteps({ type: 'delivery', fulfillmentStatus: 'delivered' })).toEqual([]);
  });

  it('groups the cards by status and keeps the order of the API', () => {
    const order = (code: string, fulfillmentStatus: DeliveryOrder['fulfillmentStatus']) =>
      ({ code, fulfillmentStatus }) as DeliveryOrder;
    const columns = groupByStatus([
      order('A', 'preparing'),
      order('B', 'pending'),
      order('C', 'ready'),
      order('D', 'pending'),
      order('E', 'on_the_way'),
    ]);

    expect(columns.map((column) => column.orders.map((o) => o.code))).toEqual([
      ['B', 'D'],
      ['A'],
      ['C', 'E'],
    ]);
  });

  it('links the delivery point to the map only when there is one', () => {
    expect(
      deliveryMapUrl({ address: 'x', references: null, latitude: 27.49, longitude: -109.93 })
    ).toBe('https://www.google.com/maps/search/?api=1&query=27.49,-109.93');
    expect(
      deliveryMapUrl({ address: null, references: null, latitude: null, longitude: null })
    ).toBeNull();
    expect(deliveryMapUrl(null)).toBeNull();
  });

  it('writes the scheduled time in Spanish', () => {
    const text = formatScheduled('2026-11-10T19:30:00');
    expect(text).toContain('10');
    expect(text).toMatch(/nov/);
    expect(text).toMatch(/7:30/);
  });
});
