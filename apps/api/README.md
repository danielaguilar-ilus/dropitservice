# apps/api

API Express para Dropit.

## Endpoints

- `POST /api/auth/login`
- `GET /api/dashboard/bootstrap`
- `GET /api/quote-requests`
- `POST /api/quote-requests`
- `PATCH /api/quote-requests/:requestId/quote`
- `POST /api/imports/validate`
- `POST /api/imports/orders`
- `POST /api/planning/routes`
- `GET /api/orders`
- `PATCH /api/orders/:orderId/status`
- `GET /api/trucks`
- `POST /api/trucks`
- `GET /api/tracking/:trackingCode`

## Nota

Los correos se registran mediante `notification.service.js` como simulados. La interfaz ya queda preparada para conectar un proveedor real.
