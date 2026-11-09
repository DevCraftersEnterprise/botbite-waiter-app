import {
  CustomerPromos,
  CustomerSort,
  CustomerStatus,
} from '../../../core/services/types/customers.types';

export const STATUS_OPTIONS: { value: CustomerStatus; label: string; badge: string }[] = [
  { value: 'new', label: 'Nuevo', badge: 'border-blue-200 bg-blue-100 text-blue-800' },
  {
    value: 'occasional',
    label: 'Ocasional',
    badge: 'border-purple-200 bg-purple-100 text-purple-800',
  },
  {
    value: 'recurring',
    label: 'Recurrente',
    badge: 'border-green-200 bg-green-100 text-green-800',
  },
  {
    value: 'inactive',
    label: 'Inactivo',
    badge: 'border-neutral-200 bg-neutral-100 text-neutral-600',
  },
];

export const PROMOS_OPTIONS: { value: CustomerPromos; label: string }[] = [
  { value: 'accepted', label: 'Aceptó' },
  { value: 'declined', label: 'Rechazó' },
  { value: 'pending', label: 'Sin respuesta' },
  { value: 'unsubscribed', label: 'Se dio de baja' },
];

export const statusLabel = (status: CustomerStatus): string =>
  STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;

export const statusBadge = (status: CustomerStatus): string =>
  STATUS_OPTIONS.find((option) => option.value === status)?.badge ?? '';

export const promosLabel = (promos: CustomerPromos): string =>
  PROMOS_OPTIONS.find((option) => option.value === promos)?.label ?? promos;

export interface SortState {
  sort: CustomerSort;
  order: 'asc' | 'desc';
}

/** Los textos empiezan de la A; los números y fechas, de lo mayor. */
const ASCENDING_FIRST: CustomerSort[] = ['name', 'promos'];

/** Clic en una columna: la ordena, y otro clic invierte el orden. */
export const nextSort = (current: SortState, column: CustomerSort): SortState =>
  current.sort === column
    ? { sort: column, order: current.order === 'asc' ? 'desc' : 'asc' }
    : { sort: column, order: ASCENDING_FIRST.includes(column) ? 'asc' : 'desc' };

/** Para lectores de pantalla: cómo está ordenada la columna. */
export const ariaSort = (
  current: SortState,
  column: CustomerSort
): 'ascending' | 'descending' | 'none' =>
  current.sort !== column ? 'none' : current.order === 'asc' ? 'ascending' : 'descending';
