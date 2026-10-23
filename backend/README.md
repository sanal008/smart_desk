# SmartDesk AI — backend

Django REST Framework API: JWT auth (accounts), ticket workflow (tickets), ML inference and
feedback (ai), dashboards (analytics).

```bash
uv sync
uv run python manage.py migrate
uv run python manage.py train_models
uv run python manage.py seed_demo
uv run python manage.py runserver
```

See the [repo README](../README.md) and [docs/API.md](../docs/API.md).
