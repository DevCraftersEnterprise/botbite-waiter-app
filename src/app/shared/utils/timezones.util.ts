export interface TimezoneOption {
  value: string;
  label: string;
}

export const DEFAULT_TIMEZONE = 'America/Hermosillo';

/** Las zonas horarias de México. Si llega un restaurante de otro país, se agregan aquí. */
export const TIMEZONES: TimezoneOption[] = [
  { value: 'America/Tijuana', label: 'Tijuana (Baja California)' },
  { value: 'America/Hermosillo', label: 'Hermosillo (Sonora)' },
  { value: 'America/Mazatlan', label: 'Mazatlán (Sinaloa, Nayarit y Baja California Sur)' },
  { value: 'America/Mexico_City', label: 'Ciudad de México (centro del país)' },
  { value: 'America/Chihuahua', label: 'Chihuahua' },
  { value: 'America/Ciudad_Juarez', label: 'Ciudad Juárez' },
  { value: 'America/Matamoros', label: 'Matamoros (frontera de Tamaulipas)' },
  { value: 'America/Cancun', label: 'Cancún (Quintana Roo)' },
];

/** Una zona guardada que no está en la lista se conserva como opción, para no perderla. */
export const timezoneOptions = (current: string | null | undefined): TimezoneOption[] =>
  current && !TIMEZONES.some((zone) => zone.value === current)
    ? [{ value: current, label: current }, ...TIMEZONES]
    : TIMEZONES;

export const timezoneLabel = (value: string | null | undefined): string =>
  TIMEZONES.find((zone) => zone.value === value)?.label ?? value ?? '';
