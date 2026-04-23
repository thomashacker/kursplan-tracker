.DEFAULT_GOAL := help

# ─────────────────────────────────────────────
# Help
# ─────────────────────────────────────────────
.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-22s\033[0m %s\n", $$1, $$2}'

# ─────────────────────────────────────────────
# Setup
# ─────────────────────────────────────────────
.PHONY: setup setup-frontend setup-backend
setup: setup-frontend setup-backend ## Install all dependencies (frontend + backend)

setup-frontend: ## Install frontend npm dependencies, create .env.local
	$(MAKE) -C frontend setup

setup-backend: ## Create Python venv, install backend dependencies, create .env
	$(MAKE) -C backend setup

# ─────────────────────────────────────────────
# Dev servers (run each in a separate terminal)
# ─────────────────────────────────────────────
.PHONY: dev-frontend dev-backend
dev-frontend: ## Start frontend dev server  (localhost:3000)
	$(MAKE) -C frontend dev

dev-backend: ## Start backend dev server   (localhost:8000)
	$(MAKE) -C backend dev

# ─────────────────────────────────────────────
# Build
# ─────────────────────────────────────────────
.PHONY: build
build: ## Build frontend for production
	$(MAKE) -C frontend build

# ─────────────────────────────────────────────
# Quality
# ─────────────────────────────────────────────
.PHONY: lint check format test
test: ## Run frontend unit tests (Vitest)
	$(MAKE) -C frontend test

lint: ## Run linters (frontend ESLint + backend ruff)
	$(MAKE) -C frontend lint
	$(MAKE) -C backend lint

format: ## Auto-format backend code with ruff
	$(MAKE) -C backend format

check: ## Type-check frontend (tsc) and backend (mypy)
	$(MAKE) -C frontend check
	$(MAKE) -C backend check

# ─────────────────────────────────────────────
# Database
# ─────────────────────────────────────────────
.PHONY: db-push db-reset
db-push: ## Apply migrations to Supabase (requires supabase CLI)
	supabase db push

db-reset: ## Reset local Supabase DB and re-apply migrations + seed
	supabase db reset

db-fresh: ## Apply full schema to a brand-new Supabase project (SQL Editor)
	@echo "Paste supabase/schema.sql into the Supabase SQL Editor for a fresh project."
	@echo "Requires pg_cron enabled (Dashboard → Database → Extensions)."

# ─────────────────────────────────────────────
# Clean
# ─────────────────────────────────────────────
.PHONY: clean
clean: ## Remove build artifacts and caches
	$(MAKE) -C frontend clean
	$(MAKE) -C backend clean
