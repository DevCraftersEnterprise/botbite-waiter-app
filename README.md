# BotBite Waiter App (panel web)

Panel de administración de **BotBite**, el mesero virtual por WhatsApp para restaurantes. Lo usan:

- **Administradores de BotBite** (`super`, `admin`): usuarios, categorías, todos los restaurantes, y asignación de créditos de mensajes.
- **Dueños de restaurante** (`client`): sus restaurantes, sucursales, productos, menús, QR de las mesas y personal de cada sucursal.
- **Cajeros y meseros** (`user`): pedidos y notificaciones en tiempo real de las sucursales que tienen asignadas, en modo lectura.

Consume la API [botbite-waiter-api](https://github.com/DevCraftersEnterprise/botbite-waiter-api).

**Stack:** Angular 20 (componentes standalone, signals) · Tailwind CSS 4 · Socket.IO client · ngx-toastr · lucide-angular · ng2-pdf-viewer.

## Puesta en marcha

Requisitos: Node.js 22+ y la API corriendo (por defecto en `http://localhost:3000`).

```bash
npm install
npm start          # http://localhost:4200
```

La URL de la API se configura en:

| Archivo | Uso |
| --- | --- |
| [src/environments/environment.development.ts](src/environments/environment.development.ts) | `ng serve` (`http://localhost:3000/v1`) |
| [src/environments/environment.ts](src/environments/environment.ts) | Build de producción (`https://api.botbite.com.mx/v1`) |

El origen del panel (por ejemplo `http://localhost:4200` o `https://app.botbite.com.mx`) debe estar en `CORS_ORIGINS` de la API. Si no, el navegador bloquea las peticiones y el WebSocket.

## Scripts

| Script | Uso |
| --- | --- |
| `npm start` | Servidor de desarrollo |
| `npm run build` | Build de producción en `dist/botbite-web-app/browser` |
| `npm run watch` | Build continuo en modo desarrollo |
| `npm test` | Pruebas unitarias (Karma) |

## Despliegue

Es una SPA estática. Publica el contenido de `dist/botbite-web-app/browser` en cualquier hosting estático (Render Static Site, Vercel, Netlify, S3 + CloudFront…) con estas condiciones:

- **Build Command:** `npm ci && npm run build`.
- **Reescritura de rutas:** toda ruta debe servir `index.html` (`/* → /index.html`). Si no, recargar en `/dashboard/...` da 404. En Netlify y Cloudflare Pages ya lo resuelve [public/_redirects](public/_redirects). En otros hostings hay que configurarlo como regla de *rewrite*.
- Antes de compilar, revisa que `environment.ts` apunte a la API de producción.

## Estructura

```
src/app/
├── core/
│   ├── guards/         # authGuard y guards por rol (super > admin > client > user)
│   ├── interceptors/   # token.interceptor: añade el JWT y renueva la sesión al recibir 401
│   └── services/       # un servicio por recurso de la API + socket.service y org.service
├── features/
│   ├── login-component/
│   ├── layout/         # shell: menú lateral, selector de restaurante y sucursal
│   ├── dashboard/      # home, users, categories, restaurants, branches, products,
│   │                   # menus, menu-items, orders, notifications
│   └── public/         # menu-viewer: PDF del menú que el bot comparte con el comensal
└── shared/             # modal, paginación, títulos, estados vacíos, utilidades
```

`OrgService` guarda el restaurante y la sucursal seleccionados. La mayoría de las pantallas trabajan sobre esa selección.

## Sesión y tiempo real

- **Login:** guarda `access_token` y `refresh_token` en `localStorage`.
- **Renovación:** ante un 401, el interceptor pide un token nuevo con `POST /auth/refresh-token` y guarda **también el nuevo refresh token**. La API los rota en cada uso e invalida el anterior.
- **Logout:** revoca el refresh token en la API.
- **WebSocket** (`/orders`): se conecta con el access token (`auth.token`) y se une a la sala de la sucursal seleccionada. Al reconectar vuelve a unirse automáticamente. Recibe:
  - `orderUpdate`: refrescar pedidos;
  - `notificationUpdate`: avisos de caja (pedido nuevo, cuenta, amenidades, alertas).

## Funciones por pantalla

| Pantalla | Rol mínimo | Qué hace |
| --- | --- | --- |
| Inicio | todos | Resumen de la sucursal: créditos disponibles y QR |
| Usuarios | admin | Crear cuentas `user` y `client`, activar o desactivar, y dar o quitar el rol admin |
| Categorías | admin | Categorías globales de productos |
| Restaurantes | user | Restaurantes propios (los cajeros ven solo los de sus sucursales) |
| Sucursales | user | Alta y edición, carga masiva por CSV, QR de la sucursal, **personal** y créditos (admin) |
| Productos | client | Catálogo, carga masiva por CSV y fotos |
| Menús | client | Menús por sucursal, items, precios, recomendados y PDF |
| Órdenes | user | Pedidos de la sucursal |
| Notificaciones | user | Avisos de caja en tiempo real; se marcan como atendidos |

### Personal de la sucursal
En **Sucursales → Personal**, el dueño (o un admin) asigna cajeros y meseros por correo. La cuenta debe existir con rol `user` (la crea un admin en **Usuarios**). El personal solo ve las sucursales asignadas y no puede modificar nada.
