import {
  DeliveryInfo,
  DeliveryOrder,
  FulfillmentStatus,
} from '../../../core/services/types/orders.type';

interface StatusLabel {
  label: string;
  classes: string;
}

export const FULFILLMENT_STATUS: Record<FulfillmentStatus, StatusLabel> = {
  pending: { label: 'Pagado', classes: 'border-amber-200 bg-amber-100 text-amber-800' },
  preparing: { label: 'En preparación', classes: 'border-blue-200 bg-blue-100 text-blue-800' },
  on_the_way: { label: 'En camino', classes: 'border-purple-200 bg-purple-100 text-purple-800' },
  ready: { label: 'Listo', classes: 'border-green-200 bg-green-100 text-green-800' },
  delivered: { label: 'Entregado', classes: 'border-neutral-200 bg-neutral-100 text-neutral-700' },
  cancelled: { label: 'Cancelado', classes: 'border-red-200 bg-red-100 text-red-800' },
};

export const ORDER_TYPE_LABEL: Record<string, string> = {
  pickup: 'Para recoger',
  delivery: 'A domicilio',
};

export interface FulfillmentStep {
  status: FulfillmentStatus;
  label: string;
}

/** Los mismos botones que caja tiene en WhatsApp. "Preparar" se puede saltar. */
export const nextSteps = (order: Pick<DeliveryOrder, 'type' | 'fulfillmentStatus'>) => {
  const handOff: FulfillmentStep =
    order.type === 'delivery'
      ? { status: 'on_the_way', label: 'Va en camino' }
      : { status: 'ready', label: 'Ya está listo' };

  switch (order.fulfillmentStatus) {
    case 'pending':
      return [{ status: 'preparing', label: 'Preparar' }, handOff] as FulfillmentStep[];
    case 'preparing':
      return [handOff];
    case 'on_the_way':
    case 'ready':
      return [{ status: 'delivered', label: 'Entregado' }] as FulfillmentStep[];
    default:
      return [];
  }
};

export interface DeliveryColumn {
  key: string;
  title: string;
  orders: DeliveryOrder[];
}

/**
 * Tarjetas por estado. Dentro de cada columna se respeta el orden de la API:
 * primero los programados, por su hora.
 */
export const groupByStatus = (orders: DeliveryOrder[]): DeliveryColumn[] => [
  {
    key: 'pending',
    title: 'Pagados',
    orders: orders.filter((order) => order.fulfillmentStatus === 'pending'),
  },
  {
    key: 'preparing',
    title: 'En preparación',
    orders: orders.filter((order) => order.fulfillmentStatus === 'preparing'),
  },
  {
    key: 'handed-off',
    title: 'En camino o listos',
    orders: orders.filter(
      (order) => order.fulfillmentStatus === 'on_the_way' || order.fulfillmentStatus === 'ready'
    ),
  },
];

/** Para abrir el punto que mandó el cliente. */
export const deliveryMapUrl = (delivery: DeliveryInfo | null): string | null =>
  delivery?.latitude != null && delivery.longitude != null
    ? `https://www.google.com/maps/search/?api=1&query=${delivery.latitude},${delivery.longitude}`
    : null;

/** "lun 10 nov, 7:30 p.m.": en español aunque la app no registre el idioma. */
export const formatScheduled = (iso: string): string =>
  new Intl.DateTimeFormat('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
