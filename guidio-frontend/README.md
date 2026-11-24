# Guidio AI — Frontend

The frontend application for **Guidio AI**, an AI-powered platform designed to help students prepare for interviews, identify skill gaps, explore career opportunities, and get AI-powered academic and career assistance.

Built with **React 19, Vite, and Tailwind CSS 4**.

---

## ✨ Overview

Guidio AI provides students with an interactive platform for:

- AI-powered student assistance
- AI mock interviews across different fields
- Skill gap analysis and improvement guidance
- Personalized career guidance
- A centralized student dashboard

This repository contains the frontend application.

For complete project documentation, including Windows 11 setup, environment variables, LAN access, deployment, and troubleshooting, see the [Root README](../README.md).

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| React 19 | UI development |
| Vite | Development server and build tool |
| Tailwind CSS 4 | Styling and responsive design |
| React Router | Client-side navigation |
| ESLint | Code quality and linting |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 22.22 or newer**
- npm
- Git

### 1. Clone the repository

```bash
git clone YOUR_FRONTEND_REPOSITORY_URL
cd guidio-frontend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create your local environment file:

**Windows PowerShell:**
```powershell
Copy-Item .env.example .env.local
```

**macOS / Linux:**
```bash
cp .env.example .env.local
```

Open `.env.local` and configure the required frontend environment variables.

### 4. Start the development server

```bash
npm run dev
```

Open the local URL displayed in your terminal, normally:

```text
http://localhost:5173
```

---

## 📜 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts the Vite development server on port 5173 |
| `npm run build` | Creates the production build inside `dist/` |
| `npm run preview` | Locally previews the production build |
| `npm run lint` | Runs ESLint to check code quality |

---

## 🌐 LAN Access

The development server can also be accessed from other devices on the same local network when configured to listen on the network interface.

For complete instructions on accessing Guidio AI from another device, refer to the [Root README](../README.md).

---

## 📦 Production Build

Generate an optimized production build:

```bash
npm run build
```

The generated files will be available in:

```text
dist/
```

To preview the production build locally:

```bash
npm run preview
```

---

## 🚀 Deployment

The frontend is designed for deployment on platforms such as **Vercel**.

Before deployment:

1. Configure the required environment variables in your hosting platform.
2. Set the correct frontend repository and root directory.
3. Use `npm install` as the install command.
4. Use `npm run build` as the build command.
5. Set `dist` as the output directory.

Refer to the [Root README](../README.md) for the complete deployment configuration.

---

## ⚙️ Development Notes

- Keep frontend environment variables in `.env.local`.
- Never commit private credentials or secret keys.
- Keep reusable UI components organized.
- Follow the existing project structure when adding new features.
- Run `npm run lint` before committing changes.
- Run `npm run build` to verify the production build.

---

## 📄 License

See the root repository documentation for licensing information.

---

<p align="center">
  **Guidio AI — Learn. Prepare. Improve. Grow.**
</p>