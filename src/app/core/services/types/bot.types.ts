export interface BotFeatures {
  interactiveMenu: boolean;
  pdfMenu: boolean;
  recommendations: boolean;
  wallet: boolean;
  mercadoPago: boolean;
  invoicing: boolean;
  promotions: boolean;
  survey: boolean;
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
  timezone: string;
  dailyCloseTime: string;
  surveyUrl: string | null;
  features: BotFeatures;
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
