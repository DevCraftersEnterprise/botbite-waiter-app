/** "HH:mm" de 24 horas, como lo guarda la API. */
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isTime = (value: string): boolean => TIME_PATTERN.test(value);

/**
 * Entiende cómo se escribe una hora a mano: "1930", "19.30", "19 30", "930" o
 * "19" pasan a "19:30", "09:30" o "19:00". Lo que no se entiende (o pasa de
 * 23:59) se regresa tal cual, para que el formulario lo marque.
 */
export const normalizeTime = (raw: string): string => {
  const text = raw.trim();
  if (!text) return '';

  const match = /^(\d{1,2})(?:[:.h ]?(\d{2}))?$/.exec(text);
  if (!match) return text;

  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? '0');
  if (hours > 23 || minutes > 59) return text;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};
