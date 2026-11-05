import { createMenuSlug, extractMenuIdFromSlug, generateSlug } from './slug-genarator.util';

describe('slug utils', () => {
  it('removes accents, symbols and repeated spaces', () => {
    expect(generateSlug('  Menú de Día ¡Especial!  ')).toBe('menu-de-dia-especial');
    expect(generateSlug('Punto  de   Unión - Cocorit')).toBe('punto-de-union-cocorit');
    expect(generateSlug('Ñandú & Co.')).toBe('nandu-co');
  });

  it('builds the menu slug with the last 8 characters of the id', () => {
    expect(createMenuSlug('Menú Comida', '6f1c2e9a-1b2c-4d5e-8f90-1234abcd5678')).toBe(
      'menu-comida-abcd5678',
    );
  });

  it('extracts the short id back from the slug', () => {
    expect(extractMenuIdFromSlug('menu-comida-abcd5678')).toBe('abcd5678');
    expect(extractMenuIdFromSlug('menu-comida-ABCD5678')).toBe('ABCD5678');
  });

  it('rejects slugs without a valid short id', () => {
    expect(extractMenuIdFromSlug('menu-comida')).toBeNull();
    expect(extractMenuIdFromSlug('menu-comida-zzzz5678')).toBeNull();
    expect(extractMenuIdFromSlug('menu-comida-abcd567')).toBeNull();
  });
});
