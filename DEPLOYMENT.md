# VPS & Docker Deployment Guide for Mikopo Lending Application

This guide explains how to deploy the **Mikopo** financial lending application on any Linux VPS (Ubuntu, Debian, DigitalOcean, Hetzner, AWS, Linode, Vultr) using Docker and Docker Compose.

---

## Prerequisites

1. A VPS running Ubuntu 22.04 LTS / Debian 12 (or similar Linux OS) with SSH access.
2. A domain name pointed to your VPS IP address (e.g., `mikopo.example.com`).
3. **Docker** and **Docker Compose** installed on your VPS.

### Quick Docker Installation on Ubuntu/Debian

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

_(Log out and log back in for group permissions to take effect)_

---

## 🚀 Quick Start Deployment

The application is deployed using a **pre-built Docker image pulled from GitHub Container Registry (GHCR)**, rather than building the image locally on the VPS. Images are built and published automatically by the CI/CD workflow whenever a release tag is pushed (see [CI/CD Automated Docker Build & GitHub Releases](#-cicd-automated-docker-build--github-releases) below).

### 1. Set Up the Deployment Directory

You only need the `docker-compose.yml` and your `.env` file on the VPS — the application source code itself does not need to be cloned, since the image already contains the built app.

```bash
mkdir -p /opt/mikopo && cd /opt/mikopo
# Copy or create docker-compose.yml and .env in this directory
```

### 2. Configure `docker-compose.yml` to Use the GHCR Image

In `docker-compose.yml`, point the `app` service at the published image instead of building locally:

```yaml
services:
  app:
    image: ghcr.io/imrany/mikopo:latest
    restart: unless-stopped
    env_file: .env
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
```

Pin to a specific version tag (e.g. `v1.2.0`) instead of `latest` for reproducible production deployments.

### 3. Configure Environment Variables

In `.env`, adjust the variables:

```bash
nano .env
```

Set your production secrets:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/database

JWT_SECRET=your_long_random_jwt_secret_key_here
PORT=3000
```

### 4. Authenticate to GHCR (if the image/package is private)

If the GHCR package is private, log in on the VPS with a GitHub Personal Access Token that has `read:packages` scope before pulling:

```bash
echo <YOUR_GITHUB_PAT> | docker login ghcr.io -u <your-github-username> --password-stdin
```

If the package is public, this step can be skipped.

### 5. Pull and Launch with Docker Compose

```bash
docker compose pull
docker compose up -d
```

Docker will:

1. Pull the pre-built `app` image from GHCR (already containing the bundled Vite output at `dist/client` / `dist/server` and the generated Prisma client).
2. Start the PostgreSQL 16 container and wait until it is healthy.
3. Run `prisma db push` inside the entrypoint script to set up PostgreSQL database tables automatically.
4. Start the server with `node dist/server/server.js` and expose the app on port `3000`.

Check container logs:

```bash
docker compose logs -f app
```

---

## 🔒 Setting up Nginx Reverse Proxy with SSL (HTTPS)

For production use, route domain traffic through Nginx with free Let's Encrypt SSL certificates.

### 1. Install Nginx and Certbot

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 2. Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/mikopo
```

Add the following block (replace `mikopo.example.com` with your domain):

```nginx
server {
    server_name mikopo.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site and test configuration:

```bash
sudo ln -s /etc/nginx/sites-available/mikopo /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. Obtain SSL Certificate

```bash
sudo certbot --nginx -d mikopo.example.com -d www.mikopo.example.com
```

Your app is now live securely at `https://mikopo.example.com`!

---

## 🚀 CI/CD Automated Docker Build & GitHub Releases

This repository includes an automated GitHub Actions workflow (`.github/workflows/docker-release.yml`).

### How It Works

Whenever you push a Git release tag matching `v*.*.*` (e.g. `v1.0.0`, `v1.2.0`), GitHub Actions will automatically:

1. Build the multi-stage Docker image using `./Dockerfile`.
2. Push the built image to GitHub Container Registry (`ghcr.io/<owner>/<repo>:<version>`).
3. Tag the image with `latest`, `v1`, `v1.2`, and `v1.2.0`.
4. Create an official **GitHub Release** with auto-generated release notes.

### Creating a Release Tag

```bash
# Create and push a version tag
git tag v1.0.0
git push origin v1.0.0
```

### Pulling Pre-built Image on VPS

This is the standard production deployment path (see [Quick Start Deployment](#-quick-start-deployment) above). With `docker-compose.yml` already pointing at the GHCR image, deploying a new release is just:

```bash
cd /opt/mikopo
docker compose pull
docker compose up -d
```

To deploy a specific version instead of `latest`, update the `image:` tag in `docker-compose.yml` (e.g. `ghcr.io/your-username/mikopo:v1.2.0`) before pulling.

1. Open your application URL (`https://mikopo.example.com`).
2. Navigate to `/setup` or click **Run Setup** on the landing/login screen.
3. Complete the step-by-step setup wizard to configure:
   - Super Admin Name & Credentials.
   - Business Details & Location.
   - M-Pesa Shortcode & Daraja Credentials (or configure in Admin Panel later).

---

## 🔄 Updating & Maintenance Commands

### Pull Latest Image & Redeploy

```bash
cd /opt/mikopo
docker compose pull
docker compose up -d
```

This pulls the latest published image from GHCR (per the tag set in `docker-compose.yml`) and recreates the `app` container. No source code or local build step is needed on the VPS.

### Restart Application

```bash
docker compose restart app
```

### View Real-time Logs

```bash
docker compose logs -f --tail=100
```

### Backup Database

```bash
docker exec mikopo_postgres pg_dump -U postgres mikopo > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore Database

```bash
cat backup.sql | docker exec -i mikopo_postgres psql -U postgres mikopo
```

---

## 🛠 Troubleshooting

### `docker compose pull` fails with `unauthorized` or `denied`

This means the GHCR package is private and the VPS isn't authenticated. Log in first:

```bash
echo <YOUR_GITHUB_PAT> | docker login ghcr.io -u <your-github-username> --password-stdin
```

The token needs at least `read:packages` scope. If the package should be public, you can change its visibility in the package settings on GitHub instead of managing tokens on every VPS.

### Build fails with `"/app/.output": not found`

_(Only relevant if you're building the image yourself rather than pulling from GHCR — e.g. when testing changes locally or debugging the CI workflow.)_

This happens when the Dockerfile expects a Nitro-style build output (`.output/`) but the project's Vite build actually produces `dist/client` and `dist/server` (this is the case for TanStack Start projects using the Vite plugin / Vite Environments API, rather than the older Nitro-based setup).

**Fix:** in the Dockerfile's runner stage, copy `dist` instead of `.output`:

```dockerfile
COPY --from=builder /app/dist ./dist
```

And in `docker-entrypoint.sh`, start the server from the correct path:

```bash
exec node dist/server/server.js
```

If your build log also generates a Prisma client to a custom path (e.g. `./src/generated`), make sure that directory is copied into the runner stage too, unless it's already inlined into the `dist/server` bundle:

```dockerfile
COPY --from=builder /app/src/generated ./src/generated
```

**To confirm which output format your build produces**, check the `pnpm run build` (or `npm run build`) log:

- If it prints `dist/client/...` and `dist/server/...` → use the `dist`-based Dockerfile above.
- If it prints `.output/server/index.mjs` → use the original `.output`-based Dockerfile.

### `npx prisma db push` fails at container startup

The runtime image runs `pnpm prune --prod --no-optional` during the build to shrink `node_modules`. If `prisma` (the CLI) is listed only under `devDependencies` in `package.json`, pruning removes it, and `npx prisma` at runtime will try to fetch the package over the network — which can fail in restricted environments. Either:

- Move `prisma` to `dependencies`, or
- Skip pruning it specifically, or
- Confirm your VPS has outbound internet access so `npx` can fetch it on demand.

### Database connection errors on first boot

If `prisma db push` fails immediately after `docker compose up`, it's usually because the `app` container started before PostgreSQL finished initializing. The entrypoint script retries once after a 5-second delay, but on slower VPS instances you may need to increase the retry count or delay, or rely on the Compose healthcheck to gate the `app` service's startup on Postgres being healthy.
