# Foliage Hunter — run from repo root (no folder hopping).
REPO := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
MOBILE := $(REPO)/mobile
TRAINING := $(REPO)/training
GUIDE := $(REPO)/guide-server

.PHONY: help start start-ts ios android web typecheck lint install \
	train train-eval sync corpus serve-start serve-stop serve-health \
	env-mobile env-remote

help: ## Show targets
	@grep -E '^[a-zA-Z0-9_-]+:.*?##' $(MAKEFILE_LIST) | awk -F':.*?## ' '{printf "  %-16s %s\n", $$1, $$2}'

# --- mobile (Expo) ---

install: ## npm install in mobile/
	cd "$(MOBILE)" && npm install

start: ## Expo Go (mobile/, clear cache)
	cd "$(MOBILE)" && npx expo start --clear

start-ts: ## Expo Go over Tailscale (phone on cellular, Mac stays home)
	cd "$(MOBILE)" && REACT_NATIVE_PACKAGER_HOSTNAME=$$(ifconfig | awk '/inet 100\./{print $$2; exit}') npx expo start --clear

ios: ## Expo iOS
	cd "$(MOBILE)" && npm run ios

android: ## Expo Android
	cd "$(MOBILE)" && npm run android

web: ## Expo web
	cd "$(MOBILE)" && npm run web

typecheck: ## tsc --noEmit in mobile/
	cd "$(MOBILE)" && npm run typecheck

lint: ## eslint in mobile/
	cd "$(MOBILE)" && npm run lint

env-mobile: ## copy mobile/.env.example → mobile/.env if missing
	@test -f "$(MOBILE)/.env" || cp "$(MOBILE)/.env.example" "$(MOBILE)/.env"
	@echo "mobile/.env ready (edit EXPO_PUBLIC_GUIDE_URL)"

# --- training (Ray / corpus) ---

train: ## submit LoRA Ray job
	"$(TRAINING)/scripts/submit_ray_lora.sh"

train-eval: ## submit held-out eval Ray job
	"$(TRAINING)/scripts/submit_ray_lora.sh" ray/foliage_eval_job.py

sync: ## optional rsync training+guide-server to Spark
	"$(TRAINING)/scripts/sync_to_spark.sh"

corpus: ## build iNat corpus
	cd "$(TRAINING)" && python3 scripts/build_inat_corpus.py

env-remote: ## copy training/scripts/remote.env.example if missing
	@test -f "$(TRAINING)/scripts/remote.env" || cp "$(TRAINING)/scripts/remote.env.example" "$(TRAINING)/scripts/remote.env"
	@echo "training/scripts/remote.env ready"

# --- guide-server helpers ---

serve-start: ## remind how to start PEFT serve on Spark
	@echo "On Spark: $(GUIDE)/start_foliage_serve.sh"
	@echo "Health: curl -fsS http://127.0.0.1:8003/health"

serve-stop: ## remind how to stop PEFT serve on Spark
	@echo "On Spark: $(GUIDE)/stop_foliage_serve.sh"

serve-health: ## curl local :8003 health
	curl -fsS http://127.0.0.1:8003/health && echo
