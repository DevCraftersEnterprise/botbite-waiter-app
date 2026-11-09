/** Mensajes por campo del formulario, en español. */
export type FieldErrors = Record<string, string>;

export interface FormErrors {
  fields: FieldErrors;
  /** Lo que no es de un campo del formulario. */
  general: string[];
}

interface ApiErrorBody {
  message?: string | string[];
}

/** Mensajes propios de la API, que no siguen el formato de class-validator. */
const KNOWN: { pattern: RegExp; field: string | null; message: (m: RegExpMatchArray) => string }[] =
  [
    {
      pattern: /^latitude and longitude are required to verify the location$/,
      field: 'latitude',
      message: () => 'Para verificar la ubicación captura las coordenadas.',
    },
    {
      pattern: /^The slug must start with (.+)$/,
      field: 'slug',
      message: (m) => `Debe empezar con ${m[1]}`,
    },
    {
      pattern: /^The slug is already in use$/,
      field: 'slug',
      message: () => 'Ese slug ya está en uso.',
    },
    {
      pattern: /^whatsappPhoneNumberId is already used by another branch$/,
      field: 'whatsappPhoneNumberId',
      message: () => 'Ese phone number ID ya lo usa otra sucursal.',
    },
    {
      pattern: /^Only administrators can change/,
      field: null,
      message: () => 'Solo un administrador de BotBite puede cambiar eso.',
    },
    {
      pattern: /^(\w+) must be in E\.164 format/,
      field: '$1',
      message: () => 'Escríbelo con + y lada, sin espacios. Por ejemplo +5216441234567.',
    },
    {
      pattern: /^property (\w+) should not exist$/,
      field: null,
      message: (m) => `El servidor no reconoce el campo ${m[1]}.`,
    },
    {
      pattern: /^Restaurant name is required$/,
      field: 'name',
      message: () => 'Es obligatorio.',
    },
    {
      pattern: /^Name must be at least (\d+) characters long$/,
      field: 'name',
      message: (m) => `Mínimo ${m[1]} caracteres.`,
    },
    {
      pattern: /^Name cannot exceed (\d+) characters$/,
      field: 'name',
      message: (m) => `Máximo ${m[1]} caracteres.`,
    },
  ];

/** Reglas de class-validator: "<campo> <regla>". */
const RULES: { pattern: RegExp; message: (m: RegExpMatchArray) => string }[] = [
  { pattern: /^must not be greater than (\S+)$/, message: (m) => `Debe ser como máximo ${m[1]}.` },
  { pattern: /^must not be less than (\S+)$/, message: (m) => `Debe ser al menos ${m[1]}.` },
  { pattern: /^must be an integer number$/, message: () => 'Debe ser un número entero.' },
  { pattern: /^must be a number/, message: () => 'Debe ser un número.' },
  {
    pattern: /^must be a URL address$/,
    message: () => 'Debe ser una URL completa, que empiece con https://.',
  },
  {
    pattern: /^must be shorter than or equal to (\d+) characters$/,
    message: (m) => `Máximo ${m[1]} caracteres.`,
  },
  {
    pattern: /^must be longer than or equal to (\d+) characters$/,
    message: (m) => `Mínimo ${m[1]} caracteres.`,
  },
  { pattern: /^should not be empty$/, message: () => 'Es obligatorio.' },
  {
    pattern: /^must be a valid IANA time-zone$|^must be a valid time zone/,
    message: () => 'No es una zona horaria válida, por ejemplo America/Hermosillo.',
  },
  {
    pattern: /^must be lowercase words separated by hyphens$/,
    message: () => 'Solo minúsculas, números y guiones.',
  },
  { pattern: /^must be numeric$/, message: () => 'Solo números.' },
  { pattern: /^must be a boolean value$/, message: () => 'Debe ser sí o no.' },
];

const translateRule = (rule: string): string =>
  RULES.map(({ pattern, message }) => {
    const match = rule.match(pattern);
    return match ? message(match) : null;
  }).find((text) => text !== null) ?? 'El valor no es válido.';

const messagesOf = (error: unknown): string[] => {
  const body = (error as { error?: ApiErrorBody } | null)?.error;
  const message = body?.message;
  if (Array.isArray(message)) return message.filter((m) => typeof m === 'string');
  return typeof message === 'string' ? [message] : [];
};

/**
 * Convierte el error de la API en mensajes en español junto al campo que
 * falla. `fields` son los campos que el formulario muestra.
 */
export const toFormErrors = (error: unknown, fields: readonly string[]): FormErrors => {
  const result: FormErrors = { fields: {}, general: [] };
  const known = new Map(fields.map((field) => [field.toLowerCase(), field]));

  const add = (field: string | null, message: string) => {
    const target = field ? known.get(field.toLowerCase()) : undefined;
    if (target) result.fields[target] ??= message;
    else if (!result.general.includes(message)) result.general.push(message);
  };

  for (const raw of messagesOf(error)) {
    const custom = KNOWN.map((rule) => ({ rule, match: raw.match(rule.pattern) })).find(
      ({ match }) => match
    );

    if (custom?.match) {
      const field = custom.rule.field === '$1' ? (custom.match[1] ?? null) : custom.rule.field;
      add(field, custom.rule.message(custom.match));
      continue;
    }

    const rule = raw.match(/^([A-Za-z][\w]*)(?:\.[\w.]+)? (.+)$/);
    if (rule) add(rule[1], translateRule(rule[2]));
    else add(null, 'No se pudo guardar. Intenta de nuevo.');
  }

  if (!messagesOf(error).length) result.general.push('No se pudo guardar. Intenta de nuevo.');
  return result;
};

/** El aviso para el toast: lo general, o que se revisen los campos marcados. */
export const formErrorSummary = (errors: FormErrors): string =>
  errors.general.length
    ? errors.general.join(' ')
    : 'No se pudo guardar. Revisa los campos marcados en rojo.';
