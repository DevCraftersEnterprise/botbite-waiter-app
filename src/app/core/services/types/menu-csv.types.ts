/** Columnas del CSV del menú, como las nombra la API. */
export type MenuCsvColumn =
  | 'nombre'
  | 'descripcion'
  | 'categoria'
  | 'precio'
  | 'familia'
  | 'recomendado'
  | 'activo'
  | 'foto_url';

/**
 * `create`: producto nuevo; `add`: el restaurante ya lo tiene y se agrega a
 * este menú; `update`: ya está en el menú y se actualiza.
 */
export type MenuImportAction = 'create' | 'add' | 'update';

export interface MenuImportIssue {
  /** Fila como la numera Excel (la 1 son los encabezados); null = el archivo. */
  row: number | null;
  column: MenuCsvColumn | null;
  message: string;
}

export interface MenuImportRow {
  row: number;
  name: string;
  category: string;
  price: number;
  action: MenuImportAction;
  /** `copy`: se sube a Cloudinary; `keep`: ya es de BotBite. */
  photo: 'copy' | 'keep' | null;
}

export interface MenuImportSummary {
  rows: number;
  categoriesToCreate: number;
  productsToCreate: number;
  productsToAdd: number;
  productsToUpdate: number;
  photosToCopy: number;
}

export interface MenuImportPreview {
  summary: MenuImportSummary;
  categoriesToCreate: string[];
  rows: MenuImportRow[];
  errors: MenuImportIssue[];
  warnings: MenuImportIssue[];
}

export interface MenuImportResult {
  message: string;
  summary: MenuImportSummary;
  warnings: MenuImportIssue[];
  photoErrors: MenuImportIssue[];
}

/** El cuerpo del 400 cuando el archivo tiene errores. */
export interface MenuImportErrorBody {
  message: string;
  errors?: MenuImportIssue[];
  warnings?: MenuImportIssue[];
}
