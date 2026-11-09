import {
  MenuCsvColumn,
  MenuImportAction,
  MenuImportIssue,
  MenuImportSummary,
} from '../../../../core/services/types/menu-csv.types';
import { generateSlug } from '../../../../shared/utils/slug-genarator.util';

const COLUMN_LABELS: Record<MenuCsvColumn, string> = {
  nombre: 'Nombre',
  descripcion: 'Descripción',
  categoria: 'Categoría',
  precio: 'Precio',
  familia: 'Familia',
  recomendado: 'Recomendado',
  activo: 'Activo',
  foto_url: 'Foto URL',
};

const ACTION_LABELS: Record<MenuImportAction, string> = {
  create: 'Nuevo',
  add: 'Se agrega',
  update: 'Se actualiza',
};

export const columnLabel = (column: MenuCsvColumn | null): string =>
  column ? COLUMN_LABELS[column] : '—';

export const actionLabel = (action: MenuImportAction): string => ACTION_LABELS[action];

/** "Fila 4" o "Archivo" cuando el problema es de todo el archivo. */
export const issueLocation = (issue: MenuImportIssue): string =>
  issue.row === null ? 'Archivo' : `Fila ${issue.row}`;

const plural = (count: number, singular: string, pluralForm: string) =>
  `${count} ${count === 1 ? singular : pluralForm}`;

/** Resumen en una línea de lo que hará la importación. */
export const summaryText = (summary: MenuImportSummary): string => {
  const parts = [
    plural(summary.productsToCreate, 'producto nuevo', 'productos nuevos'),
    plural(summary.productsToAdd, 'se agrega', 'se agregan') + ' de otros menús',
    plural(summary.productsToUpdate, 'se actualiza', 'se actualizan'),
  ];
  if (summary.categoriesToCreate) {
    parts.push(plural(summary.categoriesToCreate, 'categoría nueva', 'categorías nuevas'));
  }
  if (summary.photosToCopy) {
    parts.push(plural(summary.photosToCopy, 'foto por copiar', 'fotos por copiar'));
  }
  return parts.join(' · ');
};

export const menuCsvFileName = (menuName: string): string =>
  `menu-${generateSlug(menuName) || 'sucursal'}.csv`;

/** Descarga un archivo que ya está en memoria. */
export const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url));
};
