# Rounds Web

Web/desktop client for the Rounds Inpatient Manager mini-EMR.

## Stack

- **React 18** + **TypeScript** (Vite)
- **TailwindCSS** — clinical theme matching iOS/Android
- **React Router** — client-side routing
- **Zustand** — lightweight state management
- **TanStack Query** — server state
- **Supabase JS** — backend (shared with iOS/Android)
- **Lucide Icons** — icon set

## Getting Started

```bash
# 1. Copy env file and add your Supabase credentials
cp .env.example .env

# 2. Install dependencies
npm install

# 3. Start dev server
npm run dev
```

The app runs at `http://localhost:5173`.

## Configuration

Set these in `.env`:

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key |

## Project Structure

```
src/
  components/    # Shared UI components (ClinicalShell, banners, etc.)
  lib/           # Utilities (supabase client, cn helper)
  screens/       # Route-level screens (Auth, Home, Patients, Members, Settings)
  stores/        # Zustand stores (auth)
  index.css      # Tailwind + global styles
  main.tsx       # App entry point
  App.tsx        # Root component with routing
```

## Clinical Theme

Colors match the iOS `ClinicalTheme` and Android `ClinicalColors`:

| Token | Hex | Usage |
|-------|-----|-------|
| `clinical-primary` | `#2D6B4F` | Primary actions, success banners |
| `clinical-secondary` | `#5A8A6B` | Secondary accents |
| `clinical-background` | `#F4F7F4` | App background |
| `clinical-surface` | `#FFFFFF` | Cards, panels |
| `clinical-border` | `#BCE0C2` | Borders, dividers |
| `clinical-error` | `#CC3333` | Error banners |
| `clinical-warning` | `#D98C26` | Warning indicators |
| `clinical-info` | `#3373CC` | Info banners |

## Desktop (Tauri)

To wrap as a desktop app (planned):

```bash
npm install --save-dev @tauri-apps/cli
npx tauri init
npx tauri dev
```
