## Local development

```bash
cp .env.example .env
# fill in DATABASE_URL, JWT_ACCESS_SECRET

npm install
docker compose up -d db          # or point DATABASE_URL at any Postgres you already have
npx prisma migrate dev --name init
npm run seed                     # loads the five loan tiers (Starter -> Platinum)
npm run dev
```

Then open `http://localhost:3000/setup` — this one-time wizard creates your business profile and
your first super-admin account. After that, sign in at `/login`.

## Environment variables

See `.env.example`. Generate secrets with:

```bash
openssl rand -base64 48   # JWT_SECRET
```

`MPESA_SECURITY_CREDENTIAL` encrypts Daraja (M-Pesa) API credentials before they're stored in
Postgres — set it before you try to save credentials in the admin console's Daraja settings tab.
If you ever rotate it, previously-saved credentials become undecryptable and need re-entering.

## Deploying (self-hosted, Docker)

```bash
cp .env.example .env   # fill in real secrets — do NOT use the compose defaults in production
docker compose build
JWT_SECRET=...
docker compose up -d
```

The `app` container runs `prisma migrate deploy` automatically on start, then serves the app on
port 3000. Put a reverse proxy (nginx, Caddy, Traefik) in front of it for TLS — auth cookies only
get the `Secure` flag when `NODE_ENV=production` **and** the request is actually served over HTTPS,
so terminate TLS at the proxy.

Because this is polling-based (not WebSockets), it also runs fine on any plain Node host — the
Docker/self-hosted setup here is just what you asked for, but nothing in the app requires a
persistent connection.
