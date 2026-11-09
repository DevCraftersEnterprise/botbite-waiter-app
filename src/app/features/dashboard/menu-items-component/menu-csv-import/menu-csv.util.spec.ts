import {
  actionLabel,
  columnLabel,
  issueLocation,
  menuCsvFileName,
  summaryText,
} from './menu-csv.util';

describe('menu CSV utils', () => {
  it('names columns and actions in Spanish', () => {
    expect(columnLabel('foto_url')).toBe('Foto URL');
    expect(columnLabel('categoria')).toBe('Categoría');
    expect(columnLabel(null)).toBe('—');
    expect(actionLabel('create')).toBe('Nuevo');
    expect(actionLabel('update')).toBe('Se actualiza');
  });

  it('says where an issue is', () => {
    expect(issueLocation({ row: 4, column: 'precio', message: '' })).toBe('Fila 4');
    expect(issueLocation({ row: null, column: null, message: '' })).toBe('Archivo');
  });

  it('summarizes the import with singular and plural', () => {
    expect(
      summaryText({
        rows: 4,
        categoriesToCreate: 1,
        productsToCreate: 2,
        productsToAdd: 1,
        productsToUpdate: 0,
        photosToCopy: 0,
      })
    ).toBe('2 productos nuevos · 1 se agrega de otros menús · 0 se actualizan · 1 categoría nueva');
  });

  it('builds the export file name from the menu name', () => {
    expect(menuCsvFileName('Menú Principal')).toBe('menu-menu-principal.csv');
    expect(menuCsvFileName('¡!')).toBe('menu-sucursal.csv');
  });
});
