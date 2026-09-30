# 🏥 Campus Care

> A full-stack web platform that makes campus healthcare and student support simple, fast, and accessible.

![License](https://img.shields.io/badge/license-MIT-green.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-Frontend%20%26%20Backend-3178C6.svg)
![Supabase](https://img.shields.io/badge/Database-Supabase%20(PostgreSQL)-3ECF8E.svg)

---

## 📖 About

**Campus Care** is a collaborative project that connects students with campus care services. It lets students book and manage appointments, while giving staff a single place to manage schedules and records — replacing paper queues and scattered communication with one streamlined system.

> ✏️ *Edit this section to match your exact project goals and target users.*

## ✨ Features

- 📅 **Appointment booking** – students can schedule and manage appointments online
- 🔐 **Authentication & secure data access** – powered by Supabase
- ⏰ **Scheduled background jobs** – automated tasks (e.g., reminders) using `node-cron`
- 🔄 **Real-time updates** – WebSocket support via `ws`
- 📎 **File uploads** – handled with `multer`
- 🛡️ **Hardened API** – `helmet` security headers, `compression`, and `zod` request validation

> ✏️ *Add, remove, or rename features so this list reflects what is actually implemented.*

## 🧰 Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | TypeScript, Vite (React) |
| Backend | Node.js, TypeScript |
| Database & Auth | Supabase (PostgreSQL) |
| Validation | Zod |
| Realtime | ws (WebSockets) |
| Scheduling | node-cron |
| Security | Helmet |
| Package management | npm workspaces (Bun lockfile also included) |

## 📁 Project Structure

```
Campus-Care/
├── backend/            # Server-side API (TypeScript)
├── frontend/           # Client-side web app (Vite)
├── database/           # SQL schema / migrations
├── .env.example        # Example environment variables
├── package.json        # Root workspace & scripts
├── tsconfig.json       # TypeScript configuration
├── test-*.js           # Helper scripts for testing DB, RPC, SQL, fetch & appointments
├── LICENSE             # MIT License
└── README.md
```

The repo is an **npm workspace monorepo** — `frontend` and `backend` are managed together from the root.

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm (or [Bun](https://bun.sh/))
- A [Supabase](https://supabase.com/) project

### 1. Clone the repository

```bash
git clone https://github.com/Yeasifjanimishad/Campus-Care.git
cd Campus-Care
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example file and fill in your own Supabase credentials:

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

> ⚠️ Use **your own** Supabase project keys. Never commit real secrets to the repository.

### 4. Set up the database

Run the SQL files in the [`database/`](./database) folder in your Supabase project's **SQL Editor** to create the required tables and policies.

### 5. Run the app

```bash
npm run dev
```

This starts the frontend and backend together using `concurrently`.

## 📜 Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run frontend and backend in development mode |
| `npm run dev:frontend` | Run only the frontend |
| `npm run dev:backend` | Run only the backend |
| `npm run build` | Build both frontend and backend |
| `npm start` | Start the compiled backend (`backend/dist/index.js`) |
| `npm run preview` | Preview the production frontend build |
| `npm run lint` | Lint the frontend |
| `npm run lint:backend` | Lint the backend |
| `npm run clean` | Remove `dist` build folders |

## 🧪 Testing

Quick scripts in the project root help verify individual pieces:

```bash
node test-db.js           # Database connection
node test-sql.js          # SQL queries
node test-rpc.js          # Supabase RPC functions
node test-fetch.js        # API requests
node test-appointment.js  # Appointment flow
```

## 🤝 Contributing

This is a collaborative project, and contributions are welcome!

1. **Fork** the repository
2. **Create a branch** for your work
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Commit** your changes with a clear message
   ```bash
   git commit -m "Add: short description of your change"
   ```
4. **Push** to your branch
   ```bash
   git push origin feature/your-feature-name
   ```
5. **Open a Pull Request** describing what you changed and why

### Guidelines

- Keep pull requests focused and small where possible
- Run `npm run lint` before submitting
- Never commit secrets, tokens, or `.env` files
- Pull the latest `main` before starting new work to avoid conflicts

## 👥 Team

| Name | Role | GitHub |
| --- | --- | --- |
| Yeasif Jani Mishad | Project Owner / Developer | [@Yeasifjanimishad](https://github.com/Yeasifjanimishad) |
| *Teammate name* | *Role* | *[@username](https://github.com/username)* |

> ✏️ *Add your collaborators here.*

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](./LICENSE) for details.

---

<p align="center">Made with ❤️ for a healthier campus.</p>
