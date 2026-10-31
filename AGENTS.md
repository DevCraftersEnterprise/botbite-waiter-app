# AGENTS.md · botbite-web-app

Cómo se trabaja en este repo, tanto para personas como para agentes de código. La sección **Forma de trabajo** es igual en los tres repos de BotBite: si la cambias aquí, cámbiala también en los otros dos.

## El ecosistema

| Repo | Qué es | Dónde corre |
|---|---|---|
| `botbite-waiter-api` | API NestJS. Fuente de verdad de restaurantes, sucursales, menús, cuentas y notificaciones | Render, con Postgres en Neon |
| `botbite-web-app` | Panel para restaurantes y su personal (app.botbite.com.mx) | Netlify |
| `botbite-lander` | Landing (botbite.com.mx) | Netlify; el dominio está en GoDaddy con DNS en Netlify |

El mesero de WhatsApp corre en n8n (VPS de Hostinger, lo mantiene Carlos). Habla con la API por HTTP y no se conecta a la base.

## Forma de trabajo

### Ramas, commits y PRs

- No se hace commit directo a `main`. Cada cambio sale de `main` actualizado (`git pull`) en su propia rama: `feat/`, `fix/`, `refactor/`, `chore/` o `docs/`.
- Los commits van en inglés con Conventional Commits: `feat: …`, `fix(netlify): …`, `chore(node): …`.
- Un PR por rama hacia `main`. Lo revisa e integra Sergio. Si el cambio toca varios repos, cada PR dice en qué orden se integran y despliegan.
- Haz push seguido: lo que solo está en tu disco se puede perder.

### Idioma

- Los nombres en el código (variables, clases, columnas, rutas) van en inglés.
- Los comentarios, la documentación y los textos de la interfaz van en español.

### Antes de abrir un PR

- Corre el lint, las pruebas y el build que tenga el repo (ver **Comandos**). Si algo falla, dilo en el PR.
- Comprueba que el cambio funciona, no solo que compila.
- Si cambias variables de entorno, comandos o el despliegue, actualiza el README (y en la API, `.env.template`).

### Dependencias

- Solo se aplican actualizaciones menores o de parche. Las versiones mayores (NestJS, TypeORM, Angular…) no se suben sin acordarlo, porque rompen compatibilidad sin necesidad.
- Se usa Node 22.23.4 (`.nvmrc`), la misma versión que en Render y Netlify.

### Base de datos

- Nunca apuntes a producción desde tu máquina. El `.env` local puede tener credenciales reales; para probar usa un Postgres local o una rama de Neon.
- El esquema solo cambia con migraciones de TypeORM (`synchronize` está apagado). Cada migración tiene su `down()`, y las que ya corrieron en producción no se editan.
- Primero se agrega y después se quita. El código que deja de usar una columna o una tabla se despliega antes que la migración que la borra, porque Render corre la migración mientras la versión anterior sigue atendiendo.
- Si una migración transforma o borra datos, primero se saca un respaldo y se prueba en una rama de Neon con copia de producción.

### Seguridad

- Los secretos no van en el código, en commits, en PRs ni en chats (WhatsApp incluido). Viven en las variables de entorno de Render y Netlify o en las credenciales de n8n.
- Todo acceso a datos respeta la separación por restaurante y por sucursal.
- De los datos personales (teléfonos, datos fiscales) se guarda lo mínimo, y nunca se escriben en logs.

### Coordinación con n8n

- Las rutas que usa el bot (`/v1/bot/*`) se documentan en Swagger (`/docs`). Un cambio incompatible se le avisa a Carlos antes de desplegarlo y la fecha se acuerda con él.
- Las páginas que revisó Meta (`/agentes`, el aviso de privacidad y protección de datos) y el `<head>` de la home no se cambian sin su visto bueno.

### Después de integrar

- `main` se despliega solo. Revisa el despliegue y verifica en producción lo que cambiaste: la salud de la API, la pantalla afectada o un `curl`.

## Este repo: panel

Angular 20 (componentes standalone y signals), Tailwind 4, socket.io-client y ngx-toastr.

### Estructura

- `src/app/core/services/`: un servicio por recurso de la API. Los tipos están en `core/services/types/`.
- `src/app/core/guards/` y `src/app/core/interceptors/`: sesión, roles y renovación del token.
- `src/app/features/dashboard/<pantalla>/`: una carpeta por pantalla.
- `src/environments/`: la URL de la API (`apiBaseUrl`). En desarrollo es `http://localhost:3000/v1`.

### Comandos

```bash
npm ci
npm start          # http://localhost:4200, contra la API local
npm run build
```

Todavía no hay pruebas unitarias. Cada cambio se revisa en el navegador con la API local, entrando con un usuario de cada rol afectado.

### Convenciones

- Los roles son `SUPER`, `ADMIN`, `CLIENT` y `USER` (cajeros y meseros). Las acciones de administración se ocultan al personal, pero quien decide es la API: ocultar un botón no es un permiso.
- Los datos en vivo llegan por Socket.IO (`SocketService`). Cada pantalla se une a la sala de su sucursal (`joinBranch`) y escucha `orderUpdate` y `notificationUpdate`.
- Los avisos al usuario se muestran con ngx-toastr, en español.
- Las clases `.btn-table-*` miden 48 px por debajo de `2xl` y son solo para tablas, con el texto oculto (`hidden 2xl:inline`). En modales y tarjetas usa `.btn-small` o `.btn-small-danger`.

### Despliegue

Netlify publica `main` automáticamente. `public/_redirects` manda todas las rutas a `index.html` porque el panel es una SPA. Después de desplegar, entra a https://app.botbite.com.mx y revisa la pantalla que cambiaste.
