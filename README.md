# 🚚 DROPIT — Sistema de Gestión Logística de Última Milla

**Stack**: React 18 + Vite + TailwindCSS (frontend) · Node 20 + Express (backend) · PostgreSQL (producción) · Resend (email)

Plataforma web para cotizar fletes, planificar rutas, asignar camiones y hacer seguimiento de entregas desde un panel operativo.

---

## 🚀 Inicio rápido (local)

> ⚠️ **La aplicación real se abre en `http://localhost:5173`** (servidor de desarrollo Vite).
> NO la abras como `file://...index.html`. El archivo `apps/web/src/prototype/` es una
> maqueta estática **legacy** (solo demo visual) y NO es la aplicación principal.

### 1. Instalar dependencias (desde la raíz, usa npm workspaces)
```bash
npm install
```

### 2. Configurar entorno
```bash
cp .env.example .env   # luego completa los valores (ver sección Variables)
```

### 3. Levantar todo (API + Web en paralelo)
```bash
npm run dev
```
O por separado en dos terminales:
```bash
npm run dev:api    # API en http://localhost:4000
npm run dev:web    # Web en http://localhost:5173
```

### 4. Abrir
- **App**: http://localhost:5173
- **API health**: http://localhost:4000/health

> Las credenciales del primer usuario administrador se siembran vía el endpoint
> `/_admin/seed-users` (protegido con `ADMIN_TOKEN`) o mediante el seed de la base.
> **No se publican credenciales en este README** por seguridad.

---

## 📦 Scripts (raíz)

| Script | Acción |
|--------|--------|
| `npm run dev` | API + Web en paralelo (concurrently) |
| `npm run dev:api` | Solo API (nodemon) |
| `npm run dev:web` | Solo Web (Vite) |
| `npm run build` | Compila el frontend (`apps/web/dist`) |
| `npm run start` | Arranca la API (sirve `apps/web/dist` en producción) |

---

## ⚙️ Variables de entorno

Ver **`.env.example`** para la lista completa y comentada. Resumen de las críticas:

| Variable | Para qué |
|----------|----------|
| `DATABASE_URL` | Postgres (fuente de verdad en prod). Si falta → fallback `db.json` |
| `RESEND_API_KEY` | Envío de correo por HTTPS (recomendado, funciona en Railway) |
| `RESEND_FROM` | Remitente verificado |
| `ADMIN_TOKEN` | Protege `/_admin/*`, `/api/mail/*`, `/api/whatsapp/*` |
| `PUBLIC_URL` | Origen del frontend (CORS + links de confirmación) |
| `VITE_API_URL` | Base de la API para el frontend (`/api` en prod) |
| `SMTP_*` | Fallback de correo si no hay Resend |

---

## ☁️ Despliegue en Railway

El repo incluye `railway.toml` + `nixpacks.toml` configurados para monorepo:

1. **Install**: `npm install --include=dev` desde la raíz (workspaces → web + api).
2. **Build**: `npm run build` (compila `apps/web/dist`).
3. **Start**: `npm run start` (la API sirve el SPA + expone `/api`).

Configura las variables de entorno del servicio según `.env.example`. Para
persistencia, añade el plugin **PostgreSQL** y vincula `DATABASE_URL`.

---

## 🗄️ Persistencia

- **Producción**: PostgreSQL (`DATABASE_URL`). Schema en `apps/api/db/schema.sql`.
- **Local / fallback**: `apps/api/db.json` (solo si `DATABASE_URL` no está definida).
- Los servicios eligen el backend por `HAS_DB = !!process.env.DATABASE_URL`; no
  se mezclan estados entre ambos en una misma ejecución.
- Migración inicial de `db.json` → Postgres vía `/_admin/migrate-from-json`.

---

## 🔒 Seguridad

- Endpoints sensibles (`/api/mail/*`, `/api/whatsapp/*`, `/_admin/*`) requieren
  `ADMIN_TOKEN` o sesión de administrador (`X-User-Email` con rol admin).
- El formulario público **no** envía correos ni WhatsApp directamente: las
  notificaciones se disparan **server-side** al crear la solicitud.
- Contraseñas hasheadas con bcrypt en PostgreSQL.
- Restringe la API key de Google Maps por dominio/referrer en Google Cloud.

---

## 📁 Estructura

```
Dropit/
├── apps/
│   ├── web/                 React + Vite + Tailwind
│   │   └── src/
│   │       ├── components/
│   │       ├── pages/
│   │       ├── lib/
│   │       └── prototype/   ⚠️ maqueta estática legacy (NO es la app)
│   └── api/                 Express + Node
│       ├── src/
│       │   ├── routes/
│       │   ├── services/
│       │   ├── middleware/  auth (ADMIN_TOKEN / sesión admin)
│       │   ├── data/        db.js (Postgres) + store.js (fallback db.json)
│       │   └── config/
│       └── db/schema.sql
├── packages/shared/
├── railway.toml
├── nixpacks.toml
└── .env.example
```

---

## 📄 Licencia

Uso privado — DropIt Service.
