.DEFAULT_GOAL := help

.PHONY: help setup dev verify lint format check clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-16s\033[0m %s\n", $$1, $$2}'

setup: ## Install dependencies with uv; create .env from example if missing
	uv sync --group dev
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo ""; \
		echo "\033[33m>>> Created .env — add your credentials:\033[0m"; \
		echo "    SUPABASE_URL=https://your-project.supabase.co"; \
		echo "    SUPABASE_SERVICE_ROLE_KEY=..."; \
		echo "    SUPABASE_JWT_SECRET=..."; \
	else \
		echo ".env already exists — skipping"; \
	fi

verify: ## Check Supabase + SMTP connectivity without starting the server
	uv run python check_env.py

dev: ## Start FastAPI dev server on http://localhost:8000 (hot reload)
	uv run uvicorn app.main:app --reload --port 8000

lint: ## Run ruff linter
	uv run ruff check app/

format: ## Auto-format with ruff
	uv run ruff format app/
	uv run ruff check app/ --fix

check: ## Type-check with mypy
	uv run mypy app/

clean: ## Remove .venv and __pycache__
	rm -rf .venv
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
