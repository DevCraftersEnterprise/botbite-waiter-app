export type OrderStatus =
  | 'open'
  | 'bill_requested'
  | 'payment_link'
  | 'with_waiter'
  | 'paid'
  | 'settled'
  | 'auto_closed'
  | 'cancelled';

export type RoundStatus = 'new' | 'preparing' | 'delivered' | 'cancelled';

export interface RoundItem {
  id: string;
  menuItemId: string;
  name: string | null;
  category: string | null;
  quantity: number;
  /** Precio unitario. */
  price: number;
  note: string | null;
}

export interface OrderRound {
  id: string;
  number: number;
  status: RoundStatus;
  sentAt: string;
  acknowledgedAt: string | null;
  deliveredAt: string | null;
  items: RoundItem[];
}

/** La cuenta de una mesa: cada ronda es una comanda. */
export interface OrderAccount {
  id: string;
  code: string | null;
  source: 'whatsapp' | 'staff';
  status: OrderStatus;
  table: string | null;
  customerName: string | null;
  language: string;
  locationVerified: boolean;
  openedAt: string;
  billRequestedAt: string | null;
  closedAt: string | null;
  subtotal: number;
  walletDiscount: number;
  total: number;
  tip: number;
  paymentMethod: 'mercado_pago' | 'waiter' | null;
  rounds: OrderRound[];
}

export interface OrdersSummary {
  accounts: number;
  openAccounts: number;
  sales: number;
  tips: number;
  averageTicket: number;
  paidOnline: number;
  paidWithWaiter: number;
}

export interface CatalogItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  isActive: boolean;
}

export interface RoundItemInput {
  menuItemId: string;
  quantity: number;
  note?: string;
}
