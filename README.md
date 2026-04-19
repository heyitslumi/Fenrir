<p align="center">
  <img src="https://img.shields.io/github/stars/Luxxy-Hosting/Fenrir?style=flat-square" alt="Stars" />
  <img src="https://img.shields.io/github/license/Luxxy-Hosting/Fenrir?style=flat-square" alt="License" />
  <img src="https://img.shields.io/github/actions/workflow/status/Luxxy-Hosting/Fenrir/docker-build.yml?style=flat-square&label=docker%20build" alt="Build" />
</p>

# Fenrir Panel

A modern game server management panel built with **Next.js** and **NestJS**, designed to work with [Calagopus](https://calagopus.com) (Pelican/Pterodactyl).

## Features

- **Server Management** — Create, start, stop, restart, and delete servers with a live WebSocket console
- **File Manager** — Browse, edit, upload, download, and archive files directly in the browser
- **Backup System** — Create and restore server backups
- **Resource Allocation** — Per-user RAM, disk, CPU, and server slot limits
- **Coin Economy** — Built-in coin system with a configurable store for purchasing resources
- **AFK Rewards** — Earn coins automatically while active on the dashboard
- **Package System** — Assign resource packages to users
- **Egg Management** — Configure server templates with custom images, Docker images, and startup variables
- **Role-Based Access Control** — Granular permissions system with custom roles
- **Admin Panel** — Manage users, servers, eggs, locations, roles, packages, and settings
- **Email System** — SMTP email support with verification, login notifications, and test emails
- **Passkey Authentication** — WebAuthn/FIDO2 passwordless login support
- **API Documentation** — Auto-generated Swagger UI at `/api/docs`
- **Dark Mode** — Modern dark UI built with Tailwind CSS and shadcn/ui
- **Docker Ready** — Pre-built images on GHCR, deploy in minutes

## Tech Stack

| Layer    | Technology                        |
|----------|-----------------------------------|
| Frontend | Next.js, React, Tailwind, shadcn/ui |
| Backend  | NestJS, Prisma, PostgreSQL        |
| Auth     | JWT, WebAuthn/Passkeys            |
| Infra    | Docker, Nginx, Certbot            |

## Installation

Install Fenrir using Docker with our step-by-step guide:

**[Docker Installation Guide](https://docs.luxxy.cloud/books/fenrir/page/fenrir-panel-docker-installation)**

### Quick Start

```bash
mkdir -p /opt/fenrir && cd /opt/fenrir
curl -o docker-compose.yml https://raw.githubusercontent.com/Luxxy-Hosting/Fenrir/main/docker/docker-compose.yml
curl -o .env https://raw.githubusercontent.com/Luxxy-Hosting/Fenrir/main/docker/.env.example
nano .env
docker compose up -d
docker compose exec backend npx prisma migrate deploy
```

The first registered user is automatically assigned admin.

## Screenshots

*Coming soon*

## License

[MIT](LICENSE)

## Links

- [Documentation](https://docs.luxxy.cloud/books/fenrir)
- [Discord](https://discord.gg/luxxycloud)
- [GitHub](https://github.com/Luxxy-Hosting/Fenrir)
