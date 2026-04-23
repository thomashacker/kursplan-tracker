# Kurs.Y

Trainingsplan-Verwaltung für Sportvereine. Trainer und Coaches erstellen Wochenpläne, Mitglieder können die Pläne öffentlich oder mit Login einsehen.

## Stack

- **Frontend**: Next.js 16 (App Router, TypeScript, Tailwind CSS v4, shadcn/ui)
- **Datenbank + Auth**: Supabase (PostgreSQL, Row Level Security)

## Struktur

```
kursplan-tracker/
├── frontend/     # Next.js 16 App
└── supabase/     # Datenbankmigrationen (001–015)
```

## Entwicklung

### Voraussetzungen

- Node.js 21.7+ (or 20.12+)
- Supabase CLI (`npm install -g supabase`)

### Setup

```bash
cd frontend
npm install
cp .env.local.example .env.local
# Supabase-Zugangsdaten in .env.local eintragen
npm run dev
```

### Umgebungsvariablen (`.env.local`)

| Variable | Beschreibung |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Projekt-URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase Anon/Publishable Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key (nur serverseitig, für Account-Löschung) |

### Datenbank

```bash
# Alle Migrationen anwenden
supabase db push
```

### Make-Befehle

```bash
make setup        # npm install + .env.local anlegen
make dev          # Entwicklungsserver starten (localhost:3000)
make build        # Production Build
make test         # Unit Tests (Vitest)
make lint         # ESLint
make check        # TypeScript type-check
make db-push      # Migrationen anwenden
```

## Rollen

| Rolle | Rechte |
|---|---|
| `admin` | Alles: Mitglieder einladen/entfernen, Pläne verwalten, Vereinseinstellungen |
| `trainer` | Trainingssitzungen erstellen, bearbeiten, löschen |
| `member` | Pläne nur anzeigen (wenn Verein privat) |
| Öffentlich | Plan anzeigen ohne Login (wenn Verein öffentlich) |

## Verein erstellen

Das Erstellen eines neuen Vereins ist auf ausgewählte Accounts beschränkt. Zugang wird über `app_metadata` in Supabase verwaltet:

```sql
-- Im Supabase SQL Editor ausführen
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(raw_app_meta_data, '{can_create_club}', 'true'::jsonb)
WHERE email = 'deine@email.com';
```
