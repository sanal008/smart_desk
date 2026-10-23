import pytest
from rest_framework.test import APIClient

from accounts.models import Team, User
from tickets.models import Category, SLAPolicy, Ticket


@pytest.fixture
def client() -> APIClient:
    return APIClient()


@pytest.fixture
def teams(db):
    return {
        slug: Team.objects.create(name=slug.title(), slug=slug)
        for slug in ["support", "engineering", "finance", "logistics", "security"]
    }


@pytest.fixture
def categories(db, teams):
    mapping = {
        "billing": "finance",
        "technical": "engineering",
        "refund": "finance",
        "account": "support",
        "shipping": "logistics",
        "security": "security",
    }
    cats = {}
    for slug, team_slug in mapping.items():
        cats[slug] = Category.objects.create(
            name=slug.title(), slug=slug, default_team=teams[team_slug]
        )
        for priority in ["LOW", "MEDIUM", "HIGH", "URGENT"]:
            SLAPolicy.objects.get_or_create(
                category=cats[slug],
                priority=priority,
                defaults={"response_minutes": 60, "resolution_minutes": 720},
            )
    return cats


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        username="admin", password="pass", role="ADMIN", email="a@example.com"
    )


@pytest.fixture
def agent(db, teams):
    return User.objects.create_user(
        username="agent", password="pass", role="AGENT", team=teams["engineering"],
        skills=["technical"], email="ag@example.com",
    )


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        username="cust", password="pass", role="CUSTOMER", tier="enterprise",
        email="c@example.com",
    )


def auth(client: APIClient, user: User) -> APIClient:
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def ticket(db, customer, categories):
    t = Ticket.objects.create(
        number="TCK-00001",
        title="API returning 500 errors since this morning",
        description=(
            "All calls to /api/v2/orders are returning HTTP 500. This is breaking our "
            "checkout flow in production. Urgent, please escalate."
        ),
        requester=customer,
        category=categories["technical"],
    )
    t.apply_sla()
    t.save()
    return t
