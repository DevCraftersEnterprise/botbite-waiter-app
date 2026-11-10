/** Tipos que atiende el número de pedidos. */
export type OrderingType = 'pickup' | 'delivery';

/** Círculo donde no se entrega. Sin días ni horario aplica siempre. */
export interface NoDeliveryZone {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  /** 0 = domingo. Vacío: todos los días. */
  days: number[];
  /** HH:mm; puede cruzar la medianoche. Los dos null: todo el día. */
  from: string | null;
  to: string | null;
}

/** Ventana en que se reciben pedidos "para ahora". */
export interface OrderingHours {
  days: number[];
  opens: string;
  /** Si es menor que `opens`, cierra al día siguiente. */
  closes: string;
}

export interface OrderingScheduling {
  enabled: boolean;
  /** 1 = hoy y mañana. */
  maxDays: number;
  minLeadMinutes: number;
  stepMinutes: number;
  reminderMinutes: number;
  cancelUntilMinutes: number;
}

export interface OrderingDelivery {
  baseFee: number;
  includedKm: number;
  extraPer100m: number;
  /** En línea recta. null: sin límite. */
  maxKm: number | null;
}

/** Modo pedidos (recoger y domicilio) de una sucursal. */
export interface Ordering {
  enabled: boolean;
  /** Interruptor "Recibiendo pedidos". */
  accepting: boolean;
  phoneNumberId: string | null;
  phoneNumber: string | null;
  types: OrderingType[];
  delivery: OrderingDelivery;
  noDeliveryZones: NoDeliveryZone[];
  hours: OrderingHours[];
  scheduling: OrderingScheduling;
  /** Comisión de BotBite sobre el total, envío incluido. */
  commissionPct: number;
  paymentLinkMinutes: number;
  prepMinutes: number;
}

/** Las listas se reemplazan completas; el envío y los programados se combinan. */
export type UpdateOrdering = Partial<
  Omit<Ordering, 'delivery' | 'scheduling'> & {
    delivery: Partial<OrderingDelivery>;
    scheduling: Partial<OrderingScheduling>;
  }
>;
