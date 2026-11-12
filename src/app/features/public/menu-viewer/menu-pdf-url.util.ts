/** Donde la API sube los PDF de los menús. */
const PDF_HOST = 'res.cloudinary.com';

/** `decodeURIComponent` falla con un `%` suelto: entonces se usa el texto tal cual. */
export const safeDecode = (text: string): string => {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
};

/**
 * La URL del PDF viene en el enlace (`?url=`) y cualquiera puede armarla. Solo
 * se acepta un PDF de Cloudinary por https. Con `javascript:`, `data:`, `http:`
 * u otro dominio, regresa null y la pantalla muestra el error (issue #39).
 */
export const toSafePdfUrl = (raw: string | null): string | null => {
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(safeDecode(raw.trim()));
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' || url.hostname !== PDF_HOST) return null;
  if (url.username || url.password) return null;

  return url.toString();
};
