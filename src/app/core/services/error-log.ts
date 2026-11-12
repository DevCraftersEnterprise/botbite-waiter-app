/**
 * Los errores en la consola del navegador traen detalles internos (la URL, el
 * estado y el mensaje de la API). Solo los ve un usuario con rol `super`
 * (issue #43). `AuthService` dice quién entró; antes de saberlo, por ejemplo
 * si la app no arranca, no se muestra nada.
 */
let canSeeErrors: () => boolean = () => false;

/** Lo llama `AuthService` al crearse. */
export const setErrorLogAudience = (check: () => boolean): void => {
  canSeeErrors = check;
};

/** Usar en lugar de `console.error`. */
export const logError = (...args: unknown[]): void => {
  if (canSeeErrors()) console.error(...args);
};
