export interface BotFeatures {
  interactiveMenu: boolean;
  pdfMenu: boolean;
  recommendations: boolean;
  wallet: boolean;
  mercadoPago: boolean;
  invoicing: boolean;
  promotions: boolean;
  survey: boolean;
  /** Pregunta el idioma; apagado, el bot atiende solo en español. */
  languages: boolean;
}

/** Configuración del mesero de una sucursal. */
export interface BotConfig {
  id: string;
  slug: string;
  name: string;
  whatsappPhoneNumberId: string | null;
  botBaseUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  verifyLocation: boolean;
  geofenceMeters: number;
  qrCodeMinutes: number;
  validTables: string[];
  sessionHours: number;
  postSaleHours: number;
  maxRecommendations: number;
  /** De la sucursal: se cambia en los datos de la sucursal. */
  timezone: string;
  /** "Cierre del día" del mesero. */
  dailyCloseTime: string;
  /** Horario del mesero. Vacío: atiende siempre. */
  hours: BotHours[];
  /** Comisión de BotBite en los pagos del mesero. Solo la cambia un admin. */
  commissionPct: number;
  surveyUrl: string | null;
  features: BotFeatures;
}

/** Ventana de horario: 0 = domingo; si `closes` es menor que `opens`, cierra al día siguiente. */
export interface BotHours {
  days: number[];
  opens: string;
  closes: string;
}

export type UpdateBotConfig = Partial<Omit<BotConfig, 'id' | 'name'>>;

export interface BotKey {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface CreatedBotKey {
  key: BotKey;
  /** Valor completo: la API solo lo entrega al crearla. */
  secret: string;
}
