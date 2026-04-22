.DEFAULT_GOAL := help

.PHONY: help setup dev build lint check clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-16s\033[0m %s\n", $$1, $$2}'

setup: ## Install npm dependencies; create .env.local from example if missing
	npm install
	@if [ ! -f .env.local ]; then \
		cp .env.local.example .env.local; \
		echo ""; \
		echo "\033[33m>>> Created .env.local — add your Supabase credentials:\033[0m"; \
		echo "    NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co"; \
		echo "    NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key"; \
		echo "    NEXT_PUBLIC_API_URL=http://localhost:8000"; \
	else \
		echo ".env.local already exists — skipping"; \
	fi

dev: ## Start development server on http://localhost:3000
	npm run dev

build: ## Build for production (type-checks + compiles)
	npm run build

lint: ## Run ESLint
	npm run lint

check: ## TypeScript type-check (no emit)
	npx tsc --noEmit

clean: ## Remove .next build output and node_modules cache
	rm -rf .next
