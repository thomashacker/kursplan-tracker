# Kursplan-Tracker

Trainingsplan-Verwaltung für Sportvereine. Trainer und Coaches erstellen Wochenpläne, die zeigen wer wann wo und was trainiert. Mitglieder können die Pläne einsehen.

## Stack

- **Frontend**: Next.js 15 (App Router, TypeScript, Tailwind CSS, shadcn/ui)
- **Backend**: FastAPI (Python 3.12)
- **Datenbank + Auth**: Supabase (PostgreSQL, Row Level Security)

## Struktur

```
kursplan-tracker/
├── frontend/     # Next.js 15 App
├── backend/      # FastAPI
└── supabase/     # Datenbankmigrationen
```

## Entwicklung

### Voraussetzungen

- Node.js 20+
- Python 3.12+
- [uv](https://docs.astral.sh/uv/getting-started/installation/) (Python package manager)
- Supabase CLI (`npm install -g supabase`)

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
# Supabase-Zugangsdaten in .env.local eintragen
npm run dev
```

### Backend

```bash
cd backend
uv sync --group dev
cp .env.example .env
# Variablen in .env eintragen
uv run uvicorn app.main:app --reload
```

### Datenbank

```bash
# Migration anwenden (direkt im Supabase Dashboard SQL-Editor oder via CLI)
supabase db push
```

## Rollen

| Rolle | Rechte |
|---|---|
| `admin` | Alles: Mitglieder einladen/entfernen, Pläne verwalten, Vereinseinstellungen |
| `trainer` | Trainingssitzungen erstellen, bearbeiten, löschen |
| `member` | Pläne nur anzeigen (wenn Verein privat) |
| Öffentlich | Plan anzeigen ohne Login (wenn Verein öffentlich) |
