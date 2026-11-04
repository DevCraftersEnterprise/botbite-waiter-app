import { PaymentStatus } from '../../../core/services/types/orders.type';

interface StatusLabel {
  label: string;
  classes: string;
}

export const PAYMENT_STATUS: Record<PaymentStatus, StatusLabel> = {
  approved: { label: 'Aprobado', classes: 'border-green-200 bg-green-100 text-green-800' },
  incomplete: { label: 'Incompleto', classes: 'border-amber-200 bg-amber-100 text-amber-800' },
  unmatched: {
    label: 'Sin cuenta abierta',
    classes: 'border-red-200 bg-red-100 text-red-800',
  },
};

/** Claves del SAT que usa el mesero. Las demás se muestran tal cual. */
const PAYMENT_FORMS: Record<string, string> = {
  '01': 'Efectivo',
  '03': 'Transferencia',
  '04': 'Tarjeta de crédito',
  '28': 'Tarjeta de débito',
};

const CFDI_USES: Record<string, string> = {
  G03: 'Gastos en general',
  S01: 'Sin efectos fiscales',
};

const withName = (code: string, names: Record<string, string>): string =>
  names[code] ? `${code} · ${names[code]}` : code;

export const paymentFormLabel = (code: string): string => withName(code, PAYMENT_FORMS);

export const cfdiUseLabel = (code: string): string => withName(code, CFDI_USES);
