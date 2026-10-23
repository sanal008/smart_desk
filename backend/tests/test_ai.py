import pytest
from rest_framework.test import APIClient

from ai.models import MLPrediction
from tests.conftest import auth


@pytest.mark.django_db
def test_draft_prediction_endpoint(client: APIClient, agent):
    auth(client, agent)
    resp = client.post(
        "/api/ai/predict-draft/",
        {
            "text": "Our production API is returning 500 errors and we are losing orders. "
                    "This is urgent, please escalate to engineering immediately.",
            "tier": "enterprise",
        },
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["category"]["label"] in ("technical", "security")
    assert resp.data["priority"]["label"] in ("urgent", "high")
    assert resp.data["sentiment"]["label"] in ("negative", "neutral")
    assert resp.data["summary"]["label"]


@pytest.mark.django_db
def test_draft_prediction_forbidden_for_customers(client: APIClient, customer):
    auth(client, customer)
    resp = client.post(
        "/api/ai/predict-draft/", {"text": "x" * 30}, format="json"
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_triage_endpoint_creates_predictions(client: APIClient, agent, ticket):
    auth(client, agent)
    resp = client.post(f"/api/ai/tickets/{ticket.pk}/triage/", {}, format="json")
    assert resp.status_code == 200
    assert resp.data["status"] == "ok"
    assert ticket.predictions.filter(task="category").exists()


@pytest.mark.django_db
def test_suggest_reply_returns_draft_and_can_save(
    client: APIClient, agent, ticket
):
    auth(client, agent)
    resp = client.post(
        f"/api/ai/tickets/{ticket.pk}/suggest-reply/", {}, format="json"
    )
    assert resp.status_code == 200
    draft = resp.data["draft"]["label"]
    assert "Hi" in draft and "Best regards" in draft

    resp = client.post(
        f"/api/ai/tickets/{ticket.pk}/suggest-reply/",
        {"save_as_draft": True},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["saved_comment_id"]
    comment = ticket.comments.get(pk=resp.data["saved_comment_id"])
    assert comment.is_ai_draft is True


@pytest.mark.django_db
def test_similar_cases(client: APIClient, agent, ticket):
    auth(client, agent)
    resp = client.get(f"/api/ai/tickets/{ticket.pk}/similar/")
    assert resp.status_code == 200
    assert "cases" in resp.data


@pytest.mark.django_db
def test_feedback_loop_records_override(client: APIClient, agent, ticket):
    auth(client, agent)
    client.post(f"/api/ai/tickets/{ticket.pk}/triage/", {}, format="json")
    prediction = MLPrediction.objects.filter(ticket=ticket, task="category").first()
    assert prediction is not None

    resp = client.post(
        "/api/ai/feedback/",
        {"prediction_id": prediction.id, "accepted": False},
        format="json",
    )
    assert resp.status_code == 400

    resp = client.post(
        "/api/ai/feedback/",
        {
            "prediction_id": prediction.id,
            "accepted": False,
            "corrected_label": "technical",
            "note": "Clearly a technical issue.",
        },
        format="json",
    )
    assert resp.status_code == 201
    assert resp.data["accepted"] is False
    assert ticket.activities.filter(action="FEEDBACK").exists()


@pytest.mark.django_db
def test_model_metrics_payload(client: APIClient, agent):
    auth(client, agent)
    resp = client.get("/api/ai/metrics/")
    assert resp.status_code == 200
    assert "static_metrics" in resp.data
    assert "human_feedback" in resp.data
    assert resp.data["is_ready"] is True


@pytest.mark.django_db
def test_model_status(client: APIClient, agent):
    auth(client, agent)
    resp = client.get("/api/ai/status/")
    assert resp.status_code == 200
    assert resp.data["is_ready"] is True
    assert resp.data["version"]
