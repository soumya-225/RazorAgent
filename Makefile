# Convenience Makefile for local development with Docker
.PHONY: up down logs ps stop start test

up:
	docker-compose up --build -d

down:
	docker-compose down

logs:
	docker-compose logs -f

ps:
	docker-compose ps

exec:
	docker-compose exec app /bin/bash

test:
	./scripts/test-sbmd.sh
