export type NotificationOrder = 'oldest' | 'newest';

const STORAGE_KEY = 'botbite.notifications.order';

/** Caja atiende primero lo que llegó primero: por defecto, lo más viejo arriba. */
export const DEFAULT_ORDER: NotificationOrder = 'oldest';

export const sortByDate = <T extends { createdAt: Date | string }>(
  items: T[],
  order: NotificationOrder
): T[] => {
  const direction = order === 'oldest' ? 1 : -1;
  return [...items].sort(
    (a, b) => direction * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  );
};

/** El orden que eligió este navegador. Sin almacenamiento, el de siempre. */
export const loadOrder = (): NotificationOrder => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'newest' || saved === 'oldest' ? saved : DEFAULT_ORDER;
  } catch {
    return DEFAULT_ORDER;
  }
};

export const saveOrder = (order: NotificationOrder): void => {
  try {
    localStorage.setItem(STORAGE_KEY, order);
  } catch {
    // Navegación privada o almacenamiento bloqueado: solo dura esta visita.
  }
};
