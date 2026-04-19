# Fenrir Panel — Docker Installation

## Install Docker

```bash
curl -sSL https://get.docker.com/ | CHANNEL=stable bash
```

Verify:

```bash
docker --version
docker compose version
```

## Download Compose Stack

```bash
mkdir -p /opt/fenrir && cd /opt/fenrir
curl -o docker-compose.yml https://raw.githubusercontent.com/Luxxy-Hosting/Fenrir/main/docker/docker-compose.yml
curl -o .env https://raw.githubusercontent.com/Luxxy-Hosting/Fenrir/main/docker/.env.example
```

## Configure Environment

```bash
nano .env
```

```env
POSTGRES_USER=panel
POSTGRES_PASSWORD=CHANGE_ME
POSTGRES_DB=panel
JWT_SECRET=CHANGE_ME
CORS_ORIGIN=https://panel.example.com
NEXT_PUBLIC_API_URL=https://panel.example.com/api
```

Generate secrets:

```bash
sed -i "s|CHANGE_ME|$(openssl rand -hex 16)|g" .env
```

## Start the Panel

```bash
docker compose up -d
```

Run migrations:

```bash
docker compose exec backend npx prisma migrate deploy
```

## Reverse Proxy (Nginx)

```bash
apt install -y nginx certbot python3-certbot-nginx
```

```bash
nano /etc/nginx/sites-available/panel
```

```nginx
server {
    listen 80;
    server_name panel.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        client_max_body_size 100m;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/panel /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

## SSL

```bash
certbot --nginx -d panel.example.com
```

## Updating

```bash
cd /opt/fenrir
docker compose pull
docker compose up -d
docker compose exec backend npx prisma migrate deploy
```

## Useful Commands

```bash
docker compose -f /opt/fenrir/docker-compose.yml logs -f        # logs
docker compose -f /opt/fenrir/docker-compose.yml restart         # restart
docker compose -f /opt/fenrir/docker-compose.yml down            # stop
docker compose -f /opt/fenrir/docker-compose.yml exec postgres psql -U panel  # db shell
```
