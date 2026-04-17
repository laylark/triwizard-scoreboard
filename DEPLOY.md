# Deployment Guide

Deploys to `triwizard.laylark.dev` on a bare metal server. The app runs in a Docker container on `127.0.0.1:3000`; bare metal nginx handles SSL termination and proxies to it.

## Prerequisites

- Docker and Docker Compose installed on the server
- nginx running on the server (ports 80/443)
- certbot with the nginx plugin installed (`apt install certbot python3-certbot-nginx`)
- DNS A record pointing `triwizard.laylark.dev` (or `*.laylark.dev`) to the server IP

## nginx config

Create `/etc/nginx/sites-available/triwizard`:

```nginx
server {
    listen 80;
    server_name triwizard.laylark.dev;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name triwizard.laylark.dev;

    ssl_certificate     /etc/letsencrypt/live/triwizard.laylark.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/triwizard.laylark.dev/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # Required for Socket.io WebSocket upgrade
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_buffering off;
    }
}
```

> The `Upgrade`/`Connection` headers are required for Socket.io WebSocket connections. `proxy_buffering off` prevents nginx from buffering Socket.io's chunked responses.

## First-time deploy

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USER/triwizard-scoreboard.git /opt/triwizard-scoreboard
cd /opt/triwizard-scoreboard

# 2. Build and start the container
docker compose up -d --build

# 3. Verify the app is up
curl -s http://127.0.0.1:3000/api/scores

# 4. Enable the nginx site (HTTP only for now — no SSL lines yet)
sudo nano /etc/nginx/sites-available/triwizard   # paste the HTTP block only
sudo ln -s /etc/nginx/sites-available/triwizard /etc/nginx/sites-enabled/triwizard
sudo nginx -t && sudo systemctl reload nginx

# 5. Obtain SSL cert (certbot edits the nginx config automatically)
sudo certbot --nginx -d triwizard.laylark.dev

# 6. Verify end to end
curl -s https://triwizard.laylark.dev/api/scores
```

## Redeploy after code changes

```bash
cd /opt/triwizard-scoreboard
git pull
docker compose up -d --build
```

`data/scores.json` is bind-mounted from the host — it is never touched during a redeploy.

## Useful commands

```bash
docker compose ps              # check container status
docker compose logs --tail=50  # recent logs
docker compose stop            # stop without removing
docker compose down            # stop and remove container (data/scores.json is safe)
```
