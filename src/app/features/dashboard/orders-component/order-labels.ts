import { OrderStatus, RoundStatus } from '../../../core/services/types/orders.type';

interface StatusLabel {
  label: string;
  classes: string;
}

export const ORDER_STATUS: Record<OrderStatus, StatusLabel> = {
  open: { label: 'Abierta', classes: 'border-green-200 bg-green-100 text-green-800' },
  bill_requested: {
    label: 'Cuenta pedida',
    classes: 'border-amber-200 bg-amber-100 text-amber-800',
  },
  payment_link: { label: 'Link enviado', classes: 'border-blue-200 bg-blue-100 text-blue-800' },
  with_waiter: {
    label: 'Cobra el mesero',
    classes: 'border-purple-200 bg-purple-100 text-purple-800',
  },
  paid: { label: 'Pagada', classes: 'border-green-200 bg-green-100 text-green-800' },
  settled: { label: 'Cobrada', classes: 'border-neutral-200 bg-neutral-100 text-neutral-700' },
  auto_closed: {
    label: 'Cerrada sola',
    classes: 'border-neutral-200 bg-neutral-100 text-neutral-700',
  },
  cancelled: { label: 'Cancelada', classes: 'border-red-200 bg-red-100 text-red-800' },
};

export const ROUND_STATUS: Record<RoundStatus, StatusLabel> = {
  new: { label: 'Nueva', classes: 'border-amber-200 bg-amber-100 text-amber-800' },
  preparing: { label: 'En preparación', classes: 'border-blue-200 bg-blue-100 text-blue-800' },
  delivered: { label: 'Entregada', classes: 'border-green-200 bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelada', classes: 'border-red-200 bg-red-100 text-red-800' },
};
