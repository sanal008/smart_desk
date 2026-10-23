from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

from django.conf import settings
from django.db.models import Count, Q
from django.utils import timezone

from tickets.models import Category, Team, Ticket, TicketActivity

from .ml_core import ModelNotTrainedError, TriageEngine
from .models import AgentFeedback, MLPrediction


def _category_by_slug(slug: str) -> Category | None:
    return Category.objects.filter(slug=slug).first()


def _team_by_slug(slug: str) -> Team | None:
    return Team.objects.filter(slug=slug).first()


def _store_prediction(ticket: Ticket, task: str, result: dict, **extra) -> MLPrediction:
    explanation = {
        k: v for k, v in result.items() if k not in ("label", "confidence", "explanation")
    }
    nested = result.get("explanation")
    if isinstance(nested, dict):
        explanation.update(nested)
    defaults = {
        "predicted_label": str(result.get("label", ""))[:255],
        "confidence": float(result.get("confidence", 0.0)),
        "explanation": explanation,
        "model_version": str(result.get("model_version", ""))[:40],
    }
    defaults.update(extra)
    prediction, _ = MLPrediction.objects.update_or_create(
        ticket=ticket, task=task, defaults=defaults
    )
    return prediction


def _log(ticket: Ticket, action: str, **kwargs) -> None:
    TicketActivity.objects.create(ticket=ticket, action=action, is_ai_actor=True, **kwargs)


def triage_ticket(ticket: Ticket, actor=None, force: bool = False) -> dict:
    engine = TriageEngine.instance()
    if not engine.is_ready and not force:
        return {"status": "skipped", "reason": "model_not_trained"}

    text = ticket.text_blob
    tier = getattr(ticket.requester, "tier", "standard")
    results: dict[str, dict] = {}

    try:
        cat_result = engine.classify_category(text)
        results["category"] = cat_result
        _store_prediction(ticket, "category", cat_result)
        category = _category_by_slug(cat_result["label"])
        if category and (ticket.category_id is None or force):
            old = ticket.category
            ticket.category = category
            _log(
                ticket,
                TicketActivity.Action.AI_PREDICTED,
                field="category",
                old_value=old.name if old else "",
                new_value=category.name,
                metadata={"confidence": cat_result["confidence"]},
            )

        pri_result = engine.predict_priority(text, tier=tier)
        results["priority"] = pri_result
        _store_prediction(ticket, "priority", pri_result)
        if pri_result["confidence"] >= 0.4:
            new_priority = pri_result["label"].upper()
            if new_priority in Ticket.Priority.values and (
                ticket.priority != new_priority or force
            ):
                old = ticket.priority
                ticket.priority = new_priority
                ticket.is_priority_ai_suggested = True
                _log(
                    ticket,
                    TicketActivity.Action.AI_PREDICTED,
                    field="priority",
                    old_value=old,
                    new_value=new_priority,
                    metadata={"confidence": pri_result["confidence"], "tier": tier},
                )

        sent_result = engine.analyze_sentiment(text)
        results["sentiment"] = sent_result
        _store_prediction(ticket, "sentiment", sent_result)
        ticket.sentiment = sent_result["label"]

        team_result = engine.route_team(text, category=ticket.category.slug if ticket.category else None)
        results["team"] = team_result
        _store_prediction(ticket, "team", team_result)
        team = _team_by_slug(team_result["label"])
        if team and (ticket.team_id is None or force):
            old = ticket.team
            ticket.team = team
            _log(
                ticket,
                TicketActivity.Action.AI_PREDICTED,
                field="team",
                old_value=old.name if old else "",
                new_value=team.name,
                metadata={"confidence": team_result["confidence"]},
            )

        summary_result = engine.summarize(
            text, category=ticket.category.slug if ticket.category else None
        )
        results["summary"] = summary_result
        _store_prediction(ticket, "summary", summary_result)

        agent_result = suggest_agent(ticket)
        if agent_result:
            results["agent"] = agent_result
            _store_prediction(ticket, "agent", agent_result)

        ticket.save()
        ticket.apply_sla()
        ticket.save(update_fields=["due_at", "first_response_due_at", "sentiment", "priority",
                                   "category", "team", "is_priority_ai_suggested", "updated_at"])
        return {"status": "ok", "results": results}
    except ModelNotTrainedError as exc:
        return {"status": "error", "reason": str(exc)}


def predict_draft(text: str, tier: str = "standard") -> dict:
    engine = TriageEngine.instance()
    return {
        "category": engine.classify_category(text),
        "priority": engine.predict_priority(text, tier=tier),
        "sentiment": engine.analyze_sentiment(text),
        "team": engine.route_team(text, category=engine.classify_category(text)["label"]),
        "summary": engine.summarize(text),
        "model_version": engine.version,
    }


def suggest_agent(ticket: Ticket) -> dict | None:
    from accounts.models import User

    if not ticket.category_id:
        return None
    category_slug = ticket.category.slug
    agents = User.objects.filter(
        role__in=[User.Role.AGENT, User.Role.TEAM_LEAD], is_active=True
    ).annotate(
        open_tickets=Count(
            "assigned_tickets",
            filter=~Q(assigned_tickets__status__in=["RESOLVED", "CLOSED"]),
        ),
        resolved_in_category=Count(
            "assigned_tickets",
            filter=Q(
                assigned_tickets__status__in=["RESOLVED", "CLOSED"],
                assigned_tickets__category__slug=category_slug,
            ),
        ),
    )
    if not agents:
        return None

    scored = []
    for agent in agents:
        skills = agent.skills or []
        skill_match = 1.0 if category_slug in skills else (0.5 if agent.team == ticket.team else 0.1)
        expertise = agent.resolved_in_category * 0.15
        load_penalty = agent.open_tickets * 0.12
        score = skill_match + expertise - load_penalty
        scored.append((score, agent))

    scored.sort(key=lambda x: x[0], reverse=True)
    best_score, best = scored[0]
    top = [
        {"id": a.id, "username": a.username, "score": round(s, 3), "open_tickets": a.open_tickets}
        for s, a in scored[:3]
    ]
    return {
        "label": best.username,
        "confidence": round(min(max(best_score, 0.05), 0.98), 4),
        "explanation": {
            "user_id": best.id,
            "reasoning": (
                f"{best.username} matched category '{category_slug}' "
                f"({best.resolved_in_category} similar resolved) with {best.open_tickets} open tickets."
            ),
            "shortlist": top,
        },
        "model_version": "rules-1",
    }


def suggest_reply(ticket: Ticket, agent_name: str = "Support") -> dict:
    engine = TriageEngine.instance()
    requester_name = (ticket.requester.first_name or ticket.requester.username).strip()
    category = ticket.category.slug if ticket.category else None
    result = engine.draft_reply(
        ticket.text_blob,
        category=category,
        sentiment=ticket.sentiment or "neutral",
        requester_name=requester_name,
        agent_name=agent_name,
    )
    _store_prediction(ticket, "reply", result)
    return result


def record_feedback(prediction_id: int, reviewer, accepted: bool,
                    corrected_label: str = "", note: str = "") -> AgentFeedback:
    prediction = MLPrediction.objects.select_related("ticket").get(pk=prediction_id)
    feedback = AgentFeedback.objects.create(
        prediction=prediction,
        reviewer=reviewer,
        accepted=accepted,
        corrected_label=corrected_label,
        note=note,
    )
    TicketActivity.objects.create(
        ticket=prediction.ticket,
        actor=reviewer,
        is_ai_actor=False,
        action=TicketActivity.Action.FEEDBACK,
        field=prediction.task,
        new_value="accepted" if accepted else f"corrected:{corrected_label}",
        metadata={"prediction_id": prediction.id, "note": note},
    )
    return feedback


def load_training_metrics() -> dict:
    path = Path(settings.ML_ARTIFACTS_DIR) / "metrics.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def model_monitoring_payload() -> dict:
    engine = TriageEngine.instance()
    metrics = load_training_metrics()

    feedback_qs = AgentFeedback.objects.select_related("prediction")
    total = feedback_qs.count()
    accepted = feedback_qs.filter(accepted=True).count()

    per_task = []
    for task, _label in MLPrediction.Task.choices:
        task_fb = feedback_qs.filter(prediction__task=task)
        t_total = task_fb.count()
        t_accepted = task_fb.filter(accepted=True).count()
        per_task.append(
            {
                "task": task,
                "feedback_count": t_total,
                "accepted": t_accepted,
                "corrections": t_total - t_accepted,
                "acceptance_rate": round(t_accepted / t_total, 4) if t_total else None,
            }
        )

    corrections = Counter(
        fb.corrected_label or "(blank)" for fb in feedback_qs.filter(accepted=False)
    )

    return {
        "is_ready": engine.is_ready,
        "active_version": engine.version if engine.is_ready else None,
        "static_metrics": metrics,
        "human_feedback": {
            "total": total,
            "accepted": accepted,
            "corrected": total - accepted,
            "acceptance_rate": round(accepted / total, 4) if total else None,
            "per_task": per_task,
            "most_common_corrections": corrections.most_common(10),
        },
        "recent_runs": list(_recent_runs()),
    }


def _recent_runs():
    from .models import ModelRun

    return ModelRun.objects.values(
        "version", "trained_at", "train_size", "test_size", "metrics"
    )[:10]


def volume_timeseries(days: int = 30) -> list[dict]:
    from datetime import timedelta

    from django.db.models.functions import TruncDate

    since = timezone.now() - timezone.timedelta(days=days)
    rows = (
        Ticket.objects.filter(created_at__gte=since)
        .annotate(day=TruncDate("created_at"))
        .values("day")
        .annotate(created=Count("id"))
        .order_by("day")
    )
    resolved_rows = (
        Ticket.objects.filter(resolved_at__isnull=False, resolved_at__gte=since)
        .annotate(day=TruncDate("resolved_at"))
        .values("day")
        .annotate(resolved=Count("id"))
        .order_by("day")
    )
    resolved_map = {r["day"]: r["resolved"] for r in resolved_rows}
    out, cursor = [], since.date()
    today = timezone.now().date()
    created_map = {r["day"]: r["created"] for r in rows}

    while cursor <= today:
        out.append(
            {
                "date": cursor.isoformat(),
                "created": created_map.get(cursor, 0),
                "resolved": resolved_map.get(cursor, 0),
            }
        )
        cursor += timedelta(days=1)
    return out
