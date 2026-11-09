import { formatCoordinates, parseCoordinates } from './coordinates.util';

describe('parseCoordinates', () => {
  it('reads what Google Maps copies and rounds to 6 decimals', () => {
    expect(parseCoordinates('27.5350381, -109.9540312')).toEqual({
      latitude: 27.535038,
      longitude: -109.954031,
    });
  });

  it('accepts other separators and parentheses', () => {
    expect(parseCoordinates('(27.5,-109.9)')).toEqual({ latitude: 27.5, longitude: -109.9 });
    expect(parseCoordinates(' 27.5 -109.9 ')).toEqual({ latitude: 27.5, longitude: -109.9 });
  });

  it('tells empty from invalid', () => {
    expect(parseCoordinates('  ')).toBeNull();
    expect(parseCoordinates('27.5')).toBe('invalid');
    expect(parseCoordinates('Cócorit, Sonora')).toBe('invalid');
    expect(parseCoordinates('95, 10')).toBe('invalid');
    expect(parseCoordinates('27.5, -190')).toBe('invalid');
  });

  it('formats them back for the field', () => {
    expect(formatCoordinates(27.535038, -109.954031)).toBe('27.535038, -109.954031');
    expect(formatCoordinates(null, null)).toBe('');
  });
});
