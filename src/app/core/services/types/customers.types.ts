/** Nuevo (1 visita), ocasional (2), recurrente (3 o más) o inactivo (más de 30 días). */
export type CustomerStatus = 'new' | 'occasional' | 'recurring' | 'inactive';

/** `unsubscribed`: escribió BAJA, aunque antes hubiera aceptado. */
export type CustomerPromos = 'accepted' | 'declined' | 'pending' | 'unsubscribed';

export type CustomerSort =
  | 'name'
  | 'visits'
  | 'firstVisitAt'
  | 'lastVisitAt'
  | 'spent'
  | 'avgTicket'
  | 'walletBalance'
  | 'cashbackEarned'
  | 'promos'
  | 'status';

export interface RestaurantCustomer {
  id: string;
  name: string;
  /** Parcialmente oculto: el completo se pide aparte y queda registrado. */
  phone: string;
  visits: number;
  firstVisitAt: string | null;
  lastVisitAt: string | null;
  spent: number;
  paidOrders: number;
  avgTicket: number;
  walletBalance: number;
  cashbackEarned: number;
  promos: CustomerPromos;
  promosAt: string | null;
  status: CustomerStatus;
  favorites: string[];
}

export interface CustomerTotals {
  customers: number;
  newThisMonth: number;
  recurring: number;
  promosAccepted: number;
}

export interface CustomerListResponse {
  customers: RestaurantCustomer[];
  total: number;
  totals: CustomerTotals;
  /** La exportación se enciende cuando el aviso de privacidad la cubra. */
  exportEnabled: boolean;
  pagination: { limit: number; offset: number };
}

export interface CustomerQuery {
  limit?: number;
  offset?: number;
  search?: string;
  status?: CustomerStatus;
  promos?: CustomerPromos;
  sort?: CustomerSort;
  order?: 'asc' | 'desc';
}
