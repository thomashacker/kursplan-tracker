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
.PHONY: setup
setup: ## Install frontend dependencies, create .env.local
	$(MAKE) -C frontend setup

# ─────────────────────────────────────────────
# Dev
# ─────────────────────────────────────────────
.PHONY: dev
dev: ## Start frontend dev server (localhost:3000)
	$(MAKE) -C frontend dev

# ─────────────────────────────────────────────
# Build
# ─────────────────────────────────────────────
.PHONY: build
build: ## Build frontend for production
	$(MAKE) -C frontend build

# ─────────────────────────────────────────────
# Quality
# ─────────────────────────────────────────────
.PHONY: lint check test
test: ## Run unit tests (Vitest)
	$(MAKE) -C frontend test

lint: ## Run ESLint
	$(MAKE) -C frontend lint

check: ## TypeScript type-check
	$(MAKE) -C frontend check

# ─────────────────────────────────────────────
# Database
# ─────────────────────────────────────────────
.PHONY: db-push db-reset db-fresh
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
clean: ## Remove build artifacts
	$(MAKE) -C frontend clean
