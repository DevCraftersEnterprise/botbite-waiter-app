export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** Lo que guarda la API: 6 decimales, unos 10 cm. */
const round6 = (value: number): number => Math.round(value * 1e6) / 1e6;

/**
 * Lee las coordenadas como las copia Google Maps: "27.5350381, -109.9540312".
 * También acepta solo un espacio entre las dos o paréntesis.
 * Devuelve null si el texto está vacío y 'invalid' si no se entienden.
 */
export const parseCoordinates = (text: string): Coordinates | null | 'invalid' => {
  const clean = text
    .trim()
    .replace(/^\(|\)$/g, '')
    .trim();
  if (!clean) return null;

  const match = clean.match(/^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return 'invalid';

  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return 'invalid';

  return { latitude: round6(latitude), longitude: round6(longitude) };
};

export const formatCoordinates = (latitude: number | null, longitude: number | null): string =>
  latitude === null || longitude === null ? '' : `${latitude}, ${longitude}`;
