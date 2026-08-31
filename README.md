[![Docker Image](https://img.shields.io/badge/docker-ghcr.io%2Fimrany%2Fmikopo-blue?logo=docker)](https://github.com/imrany/Mikopo/pkgs/container/mikopo)
[![GitHub Repository](https://img.shields.io/badge/github-imrany%2FMikopo-black?logo=github)](https://github.com/imrany/Mikopo)
[![Database](https://img.shields.io/badge/database-PostgreSQL%2016-blue?logo=postgresql)](https://www.postgresql.org/)
[![Payment](https://img.shields.io/badge/payment-M--Pesa-brightgreen)](https://developer.safaricom.co.ke/)
[![License](https://img.shields.io/badge/license-Apache--2.0-green)](./LICENSE)

**Mikopo** is a modern, enterprise-ready, self-hostable microfinance lending platform and credit operating system designed for micro-lenders, SACCOs, fintech startups, and investment groups. It features automated credit scoring, dynamic tier unlocks, multi-party guarantor verification workflows, and supports **M-Pesa** (B2C disbursements + STK Push repayments).


## 🏛️ System Architecture

```
                       ┌──────────────────────────────────────┐
                       │   Borrowers & Mobile Web Clients     │
                       └──────────────────┬───────────────────┘
                                          │ HTTPS (Port 443)
                                          ▼
                       ┌──────────────────────────────────────┐
                       │      Nginx / Caddy Reverse Proxy     │
                       │ (SSL Termination, Rate Limit, Cache) │
                       └──────────────────┬───────────────────┘
                                          │ Port 3000
                                          ▼
     ┌────────────────────────────────────────────────────────────────────────┐
     │                      Docker Container: mikopo_app                      │
     │                      ghcr.io/imrany/mikopo:latest                      │
     │                                                                        │
     │  ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐  │
     │  │   Lending Engine   │ │  Daraja Connector  │ │ Security & Roles  │  │
     │  │ (Tiers & Penalties)│ │ (B2C & STK Push)   │ │ (JWT, RBAC Matrix) │  │
     │  └────────────────────┘ └────────────────────┘ └────────────────────┘  │
     └───────────────────┬───────────────────────────────┬────────────────────┘
                         │                               │
                         ▼                               ▼
       ┌───────────────────────────────────┐ ┌───────────────────────────────┐
       │   PostgreSQL 16 Engine Container  │ │   Safaricom Daraja API Gateway│
       │    (Volume: postgres_data)        │ │  (B2C Payouts & STK Callbacks)│
       └───────────────────────────────────┘ └───────────────────────────────┘
```


## 🚀 Quick Start (Docker & GHCR)

Deploy Mikopo on any Linux VPS (Ubuntu, Debian, Hetzner, AWS, DigitalOcean, Linode) in 4 simple steps:

### Step 1: Create directory and download configurations

```bash
mkdir -p /opt/mikopo && cd /opt/mikopo

# Fetch production compose file and environment template
curl -fsSL https://raw.githubusercontent.com/imrany/Mikopo/main/docker-compose.yml -o docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/imrany/Mikopo/main/.env.example -o .env
```

### Step 2: Configure secrets in `.env`

```bash
# Generate a strong 64-byte random string for your JWT secret
openssl rand -base64 48

# Edit configuration
nano .env
```

Ensure you update:

- `POSTGRES_PASSWORD`: Strong password for internal PostgreSQL database.
- `JWT_SECRET`: The generated random secret for secure auth sessions.
- `MPESA_SECURITY_CREDENTIAL`: 32-character key to encrypt M-Pesa API credentials at rest.

### Step 3: Pull from GitHub Container Registry & Start

```bash
# Pull pre-built multi-arch image
docker compose pull

# Start containers in background
docker compose up -d

# Verify logs & status
docker compose ps
docker compose logs -f app
```

### Step 4: Run the One-Time Setup Wizard

Open your browser to:
👉 **`http://your-server-ip:3000/setup`**

1. Register your **Business Profile** (Organization Name, Support Hotline, Currency, Brand Color).
2. Create your **Super Admin Account** (Email & Password).
3. The platform will automatically initialize database seeds and loan tiers (Starter -> Platinum).


## 📦 Pulling Pre-Built Docker Images from GHCR

Mikopo releases official Docker images directly to GitHub Container Registry:

| Registry             | Image Identifier               | Notes                          |
| :------------------- | :----------------------------- | :----------------------------- |
| **GHCR**             | `ghcr.io/imrany/mikopo:latest` | Latest stable build            |
| **GHCR (Versioned)** | `ghcr.io/imrany/mikopo:v0.1.0` | Recommended for production pin |

```bash
docker pull ghcr.io/imrany/mikopo:latest
```

_If pulling from a private repository, authenticate using a GitHub Personal Access Token:_

```bash
echo "YOUR_GITHUB_PAT" | docker login ghcr.io -u imrany --password-stdin
```


## ⚙️ Environment Variables Reference

| Variable                       |    Required     | Default        | Description                                        |
| :----------------------------- | :-------------: | :------------- | :------------------------------------------------- |
| `DATABASE_URL`                 |     **Yes**     | —              | PostgreSQL connection string                       |
| `JWT_SECRET`                   |     **Yes**     | —              | Secret key for signing user auth tokens            |
| `MPESA_SECURITY_CREDENTIAL`    | **Recommended** | —              | AES key for encrypting Daraja credentials in DB    |
| `PORT`                         |       No        | `3000`         | HTTP port the Node.js server listens on            |
| `UPLOAD_DIR`                   |       No        | `/app/uploads` | Persistent directory for KYC & ID documents        |
| `SCHEDULER_INTERVAL_MINUTES`   |       No        | `10`           | Frequency for penalty calculations & due reminders |
| `SMTP_HOST` / `SMTP_PORT`      |       No        | —              | SMTP mail server for transactional notifications   |
| `VAPID_PUBLIC_KEY` / `PRIVATE` |       No        | —              | Web push notification VAPID credentials            |


## 📱 Safaricom M-Pesa Daraja Integration

Mikopo includes first-class support for automated Kenyan mobile money operations:

1. **B2C Automated Disbursement**: When a loan is approved by staff, funds are sent instantly to the borrower's registered M-Pesa line.
2. **STK Push (Express Repayment)**: Borrowers click "Repay via M-Pesa", prompting an immediate SIM PIN pop-up on their phone.
3. **Encrypted Key Storage**: Manage Daraja Consumer Key, Secret, Shortcode, and Passkey safely via the Admin Console (`/admin/settings`).

### Webhook Endpoints

- **STK Callback:** `https://yourdomain.com/api/public/mpesa/stk-callback`
- **B2C Result:** `https://yourdomain.com/api/public/mpesa/b2c-result`


## 🔒 Production Nginx Reverse Proxy with Free SSL

```nginx
server {
    listen 80;
    server_name mikopo.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name mikopo.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/mikopo.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mikopo.yourdomain.com/privkey.pem;

    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable SSL automatically with Certbot:

```bash
sudo certbot --nginx -d mikopo.yourdomain.com -d www.mikopo.yourdomain.com
```


## 💻 Local Development

```bash
# 1. Clone repo
git clone https://github.com/imrany/mikopo.git
cd mikopo

# 2. Install dependencies & configure env
pnpm install
cp .env.example .env

# 3. Start Postgres & migrate
docker compose up -d postgres
pnpm run prisma:push

# 4. Start local development server
pnpm run dev
```

Visit `http://localhost:3000` or view the complete interactive guide at `http://localhost:3000/docs`.


## 📄 License

Distributed under the MIT License. See [LICENSE](./LICENSE) for details.
