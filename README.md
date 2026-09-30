# Toque · Propinas con NFC (versión web)

El cliente acerca su celular a la tarjeta NFC del trabajador, ve su nombre y el monto, y paga.
El trabajador ve su saldo y avisos en tiempo real desde una web instalable (PWA).

## Rutas

| Ruta | Quién la usa | Qué hace |
|---|---|---|
| `/t/[codigo]` | Cliente | Página que abre la tarjeta NFC / QR. Monto, comisión opcional, pago y calificación |
| `/entrar` | Trabajador | Crear cuenta o entrar |
| `/panel` | Trabajador | Saldo, monto de la tarjeta, tarjetas + QR + link para grabar en NFC, movimientos, retiros |
| `/api/checkout` | Servidor | Crea el cobro en Stripe (solo con Stripe configurado) |
| `/api/stripe/webhook` | Stripe | Marca la propina como pagada y suma el saldo |

## Correr en local

```bash
npm install
npm run dev
```

Se abre en `http://localhost:3000` y también en la red WiFi (`http://<IP-de-tu-PC>:3000`) para probar desde el celular.
La IP que se graba en las tarjetas está en `NEXT_PUBLIC_SITE_URL` (`.env.local`).

## Modo demo vs. cobros reales

- `app_config.demo_mode = true` (por defecto): los pagos se simulan, no se cobra nada.
- Para cobrar con Stripe:
  1. Llenar en `.env.local`: `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
  2. Registrar el webhook `…/api/stripe/webhook` con los eventos `payment_intent.succeeded` y `payment_intent.payment_failed`.
  3. En Stripe, registrar el dominio para Apple Pay (requiere HTTPS, p. ej. Vercel).
  4. `update app_config set demo_mode = false;`

## Base de datos

Supabase, esquema en `supabase/migrations/`. Todo con RLS: cada trabajador solo ve lo suyo;
el cliente solo accede a los datos públicos de la tarjeta vía `get_tag_public`.

## Pendiente (siguientes fases)

- Stripe Connect: alta del trabajador (verificación INE + CLABE) para que el dinero le llegue directo.
- Retiros reales (hoy solo se registran).
- Notificaciones push web (hoy: aviso dentro de la app con el panel abierto).
- App nativa (Expo) con Tap to Pay y App Clip, reutilizando este backend.
