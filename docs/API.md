# SmartDesk AI — API Reference

Base URL: `http://localhost:8000/api` (dev)

All endpoints require `Authorization: Bearer <access>` except register/login/refresh.
Responses are JSON; list endpoints are paginated (`count`, `next`, `previous`, `results`)
with `page` and `page_size` (max 100).

## Auth — `/api/auth/`

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/login/` | public | Body `{username, password}` → `{access, refresh, user}` |
| POST | `/refresh/` | public | Body `{refresh}` → `{access}` (rotates; old refresh blacklisted) |
| POST | `/register/` | public | Creates a CUSTOMER (or requested tier); returns tokens |
| POST | `/logout/` | user | Blacklists the supplied refresh token |
| GET/PATCH | `/me/` | user | Read/update profile (name, email, title) |
| POST | `/me/password/` | user | `{old_password, new_password}` |
| GET | `/users/` | agent+ | Directory; filters `role`, `team`, `tier`, `search` |
| POST/PATCH/DELETE | `/users/{id}/` | admin | User management |
| GET | `/teams/` | user | Teams with `member_count` |
| POST | `/teams/` | admin | Create team (`name`, `slug`, `expertise[]`) |

**Roles:** `CUSTOMER`, `AGENT`, `TEAM_LEAD`, `ADMIN`. Staff-side = agent and above.

## Tickets — `/api/tickets/`

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/` | user | Filtered list. Customers see only their own tickets |
| POST | `/` | user | Create `{title, description, category?}` → **auto AI triage** |
| GET | `/board/` | user | `{columns: {NEW: [...], TRIAGED: [...]}, total}` for the Kanban |
| GET/PATCH | `/{id}/` | owner/staff | Detail (with predictions, comments, activities) / partial update |
| POST | `/{id}/assign/` | staff | `{assignee?, team?}` — logs ASSIGNED activity |
| POST | `/{id}/status/` | staff | `{status}` — stamps first-response / resolved times |
| GET/POST | `/{id}/comments/` | user | Customers never see `is_internal` comments |
| POST | `/{id}/attachments/` | user | multipart `files` (or `file`) |
| GET | `/{id}/activities/` | user | Audit trail (human + AI actions) |

### Query filters (list + board)

| Param | Values |
| --- | --- |
| `q` | free text over title, body, ticket number |
| `status` / `priority` | exact or `in=A,B` |
| `category`, `assignee`, `team`, `requester` | id |
| `sla_status` | `breached` \| `at_risk` (next 4 h) \| `ok` |
| `open_only` | `true` excludes RESOLVED/CLOSED |
| `ordering` | `created_at`, `-created_at`, `due_at`, `-due_at`, `priority`, `-priority` |
| `page`, `page_size` | pagination |

### Status machine

`NEW → TRIAGED → IN_PROGRESS ⇄ WAITING_CUSTOMER → RESOLVED → CLOSED` (reopen allowed from
resolved/closed). First move into `IN_PROGRESS`/`WAITING_CUSTOMER` stamps `first_response_at`;
entering `RESOLVED`/`CLOSED` stamps `resolved_at`. SLA deadlines recompute from `SLAPolicy`.

## AI — `/api/ai/`

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/status/` | user | `{is_ready, version, artifact}` |
| POST | `/predict-draft/` | staff | `{text, tier}` → category/priority/sentiment/team/summary without saving |
| POST | `/tickets/{id}/triage/` | staff | Re-run full pipeline (`force` default true) |
| POST | `/tickets/{id}/suggest-reply/` | staff | `{save_as_draft?}` → retrieval-based draft; optionally stored as AI comment |
| GET | `/tickets/{id}/similar/` | staff | Top-k similar resolved cases (cosine) |
| GET | `/tickets/{id}/predictions/` | user | All stored predictions for a ticket |
| POST | `/feedback/` | staff | `{prediction_id, accepted, corrected_label?, note?}` — correction requires label |
| GET | `/feedback/` | staff | Filter `prediction__task`, `accepted`, `reviewer` |
| GET | `/metrics/` | staff | Offline metrics + live human-feedback stats + training runs |
| GET | `/runs/` | staff | `ModelRun` history |
| POST | `/reload/` | staff | Drop cached joblib artifacts after a retrain |

### Prediction object

```json
{
  "task": "category",
  "predicted_label": "refund",
  "confidence": 0.51,
  "explanation": {
    "top_features": [{"feature": "refund", "weight": 2.1}, ...],
    "probabilities": {"refund": 0.51, "billing": 0.38, ...}
  },
  "model_version": "v20261023-1136"
}
```

Tasks: `category`, `priority`, `team`, `sentiment`, `summary`, `agent`, `reply`.

## Analytics — `/api/analytics/`

| Method | Path | Description |
| --- | --- | --- |
| GET | `/overview/` | Totals, by_priority/status/category/sentiment, SLA aggregates |
| GET | `/volume/?days=30` | Daily created vs resolved series |
| GET | `/agent-workload/` | Per-agent open/resolved/urgent + avg first response |
| GET | `/category-trends/?days=30` | Per-category daily counts |
| GET | `/sla/` | Breached + at-risk ticket lists (staff-side) |

## Error format

```json
{ "detail": "..." }
```

Field validation errors use `{ "field": ["message", ...] }`. `401` on expired access tokens
triggers a client-side refresh + replay; `503` from AI endpoints means artifacts are missing —
run `manage.py train_models`.

## RBAC matrix

| Capability | Customer | Agent | Team lead | Admin |
| --- | --- | --- | --- | --- |
| Own tickets, comments, attachments | ✓ | ✓ | ✓ | ✓ |
| All tickets, board, assignment | – | ✓ | ✓ | ✓ |
| AI draft predictions / reply drafts | – | ✓ | ✓ | ✓ |
| Feedback on predictions | – | ✓ | ✓ | ✓ |
| Analytics | – | ✓ | ✓ | ✓ |
| Model monitoring | – | – | ✓ | ✓ |
| User/team/category/SLA management | – | – | – | ✓ |
