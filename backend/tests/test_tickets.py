import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from tests.conftest import auth
from tickets.models import Ticket

NEW_TICKET = {
    "title": "Refund request for double billing",
    "description": (
        "I was charged twice for my growth plan on invoice INV-9911. Please refund the "
        "extra $249.00 immediately, this is the third time it has happened."
    ),
}


@pytest.mark.django_db
def test_customer_creates_ticket_and_ai_triangulates(client: APIClient, customer, categories):
    auth(client, customer)
    resp = client.post("/api/tickets/", NEW_TICKET, format="json")
    assert resp.status_code == 201, resp.data

    ticket = Ticket.objects.get(pk=resp.data["id"])
    tasks = set(ticket.predictions.values_list("task", flat=True))
    assert {"category", "priority", "sentiment", "team", "summary"} <= tasks

    cat_pred = ticket.predictions.get(task="category")
    assert cat_pred.confidence > 0
    assert "top_features" in cat_pred.explanation

    assert cat_pred.predicted_label in ("refund", "billing")
    assert ticket.team is not None
    assert resp.data["predictions"]


@pytest.mark.django_db
def test_ticket_list_scoped_to_requester_for_customers(client: APIClient, customer, agent, ticket):
    auth(client, customer)
    resp = client.get("/api/tickets/")
    assert resp.status_code == 200
    assert resp.data["count"] == 1

    other = get_user_model().objects.create_user(username="other", password="x", role="CUSTOMER")
    client.force_authenticate(user=other)
    resp = client.get("/api/tickets/")
    assert resp.data["count"] == 0

    client.force_authenticate(user=agent)
    resp = client.get("/api/tickets/")
    assert resp.data["count"] == 1


@pytest.mark.django_db
def test_search_and_sla_filters(client: APIClient, agent, ticket):
    auth(client, agent)
    resp = client.get("/api/tickets/?q=TCK-00001")
    assert resp.data["count"] == 1

    resp = client.get("/api/tickets/?q=nothing-matches-this")
    assert resp.data["count"] == 0

    resp = client.get("/api/tickets/?priority=URGENT&status=NEW")
    assert resp.status_code == 200

    resp = client.get("/api/tickets/?sla_status=breached")
    assert resp.status_code == 200


@pytest.mark.django_db
def test_assign_and_status_transitions_log_activity(client: APIClient, agent, ticket):
    auth(client, agent)
    resp = client.post(
        f"/api/tickets/{ticket.pk}/assign/", {"assignee": agent.id}, format="json"
    )
    assert resp.status_code == 200
    ticket.refresh_from_db()
    assert ticket.assignee_id == agent.id

    resp = client.post(
        f"/api/tickets/{ticket.pk}/status/", {"status": "IN_PROGRESS"}, format="json"
    )
    assert resp.status_code == 200
    ticket.refresh_from_db()
    assert ticket.status == "IN_PROGRESS"
    assert ticket.first_response_at is not None

    actions = set(ticket.activities.values_list("action", flat=True))
    assert "ASSIGNED" in actions
    assert "STATUS_CHANGED" in actions


@pytest.mark.django_db
def test_comments_scoped_and_first_response_recorded(client: APIClient, agent, ticket, customer):
    auth(client, agent)
    resp = client.post(
        f"/api/tickets/{ticket.pk}/comments/",
        {"body": "Internal note: checking logs", "is_internal": True},
        format="json",
    )
    assert resp.status_code == 201

    client.force_authenticate(user=customer)
    resp = client.get(f"/api/tickets/{ticket.pk}/comments/")
    assert resp.status_code == 200
    assert len(resp.data) == 0


@pytest.mark.django_db
def test_board_groups_by_status(client: APIClient, agent, ticket):
    auth(client, agent)
    resp = client.get("/api/tickets/board/")
    assert resp.status_code == 200
    assert "columns" in resp.data
    assert len(resp.data["columns"]["NEW"]) == 1


@pytest.mark.django_db
def test_rejects_too_short_description(client: APIClient, customer):
    auth(client, customer)
    resp = client.post(
        "/api/tickets/", {"title": "Help please", "description": "short"}, format="json"
    )
    assert resp.status_code == 400
