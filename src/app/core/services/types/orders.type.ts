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

export interface BranchCatalog {
  catalog: CatalogItem[];
  validTables: string[];
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
  /** Total más propina: lo que se le cobra al comensal. */
  amountDue: number;
  paymentMethod: 'mercado_pago' | 'waiter' | null;
  rounds: OrderRound[];
}

export type OrderType = 'dine_in' | 'pickup' | 'delivery';

/** Entrega de un pedido de recoger o domicilio, desde que se paga. */
export type FulfillmentStatus =
  | 'pending'
  | 'preparing'
  | 'on_the_way'
  | 'ready'
  | 'delivered'
  | 'cancelled';

/** Dónde entregar. La API la borra 30 días después. */
export interface DeliveryInfo {
  address: string | null;
  references: string | null;
  latitude: number | null;
  longitude: number | null;
}

/** Pedido de recoger o domicilio ya pagado, en "Para entregar". */
export interface DeliveryOrder extends OrderAccount {
  type: OrderType;
  fulfillmentStatus: FulfillmentStatus;
  fulfillmentUpdatedAt: string | null;
  scheduledFor: string | null;
  deliveryFee: number;
  delivery: DeliveryInfo | null;
  /** Para llamar al cliente. */
  phone: string | null;
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

export type PaymentStatus = 'approved' | 'incomplete' | 'unmatched';

/** Pago aprobado por Mercado Pago. */
export interface BillingPayment {
  id: string;
  paidAt: string;
  status: PaymentStatus;
  orderCode: string | null;
  table: string | null;
  consumption: number;
  tip: number;
  /** Lo que debía la cuenta. */
  amount: number;
  /** Lo que reportó Mercado Pago. */
  paidAmount: number;
  paymentType: string | null;
  cashbackEarned: number;
  providerPaymentId: string;
}

/** Factura que timbró el mesero. */
export interface BillingInvoice {
  id: string;
  issuedAt: string;
  folio: string;
  /** Folio fiscal del SAT. */
  uuid: string;
  orderCode: string | null;
  table: string | null;
  rfc: string;
  legalName: string;
  cfdiUse: string;
  paymentForm: string;
  total: number;
  emailSent: boolean;
}

export interface BillingDay {
  /** YYYY-MM-DD en la zona horaria de la sucursal. */
  date: string;
  payments: BillingPayment[];
  invoices: BillingInvoice[];
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
