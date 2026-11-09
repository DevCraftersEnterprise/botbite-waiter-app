import { loadOrder, saveOrder, sortByDate } from './notifications-order.util';

describe('notifications order', () => {
  const items = [
    { id: 'b', createdAt: '2026-11-09T10:05:00Z' },
    { id: 'a', createdAt: '2026-11-09T10:00:00Z' },
    { id: 'c', createdAt: new Date('2026-11-09T10:10:00Z') },
  ];

  afterEach(() => localStorage.removeItem('botbite.notifications.order'));

  it('puts the oldest first, or the newest when asked', () => {
    expect(sortByDate(items, 'oldest').map((n) => n.id)).toEqual(['a', 'b', 'c']);
    expect(sortByDate(items, 'newest').map((n) => n.id)).toEqual(['c', 'b', 'a']);
  });

  it('does not change the list it receives', () => {
    sortByDate(items, 'oldest');
    expect(items.map((n) => n.id)).toEqual(['b', 'a', 'c']);
  });

  it('remembers the order in this browser, oldest first by default', () => {
    expect(loadOrder()).toBe('oldest');
    saveOrder('newest');
    expect(loadOrder()).toBe('newest');
  });
});
