import { ariaSort, nextSort, promosLabel, statusBadge, statusLabel } from './customers.util';

describe('customers utils', () => {
  it('names statuses and promotions in Spanish', () => {
    expect(statusLabel('recurring')).toBe('Recurrente');
    expect(statusLabel('inactive')).toBe('Inactivo');
    expect(statusBadge('new')).toContain('bg-blue-100');
    expect(promosLabel('unsubscribed')).toBe('Se dio de baja');
    expect(promosLabel('pending')).toBe('Sin respuesta');
  });

  it('sorts a new column and inverts it on a second click', () => {
    const byDate = { sort: 'lastVisitAt' as const, order: 'desc' as const };

    expect(nextSort(byDate, 'spent')).toEqual({ sort: 'spent', order: 'desc' });
    expect(nextSort(byDate, 'name')).toEqual({ sort: 'name', order: 'asc' });
    expect(nextSort(byDate, 'lastVisitAt')).toEqual({ sort: 'lastVisitAt', order: 'asc' });
  });

  it('tells screen readers how a column is sorted', () => {
    const state = { sort: 'visits' as const, order: 'asc' as const };
    expect(ariaSort(state, 'visits')).toBe('ascending');
    expect(ariaSort(state, 'spent')).toBe('none');
  });
});
