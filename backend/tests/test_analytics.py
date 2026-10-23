import pytest
from rest_framework.test import APIClient

from tests.conftest import auth


@pytest.mark.django_db
def test_overview_metrics(client: APIClient, agent, ticket):
    auth(client, agent)
    resp = client.get("/api/analytics/overview/")
    assert resp.status_code == 200
    assert resp.data["totals"]["all"] == 1
    assert "by_priority" in resp.data
    assert "sla" in resp.data


@pytest.mark.django_db
def test_volume_timeseries_shape(client: APIClient, agent):
    auth(client, agent)
    resp = client.get("/api/analytics/volume/?days=14")
    assert resp.status_code == 200
    assert len(resp.data["series"]) == 15
    assert set(resp.data["series"][0]) == {"date", "created", "resolved"}


@pytest.mark.django_db
def test_agent_workload(client: APIClient, agent, ticket):
    auth(client, agent)
    resp = client.get("/api/analytics/agent-workload/")
    assert resp.status_code == 200
    assert any(a["username"] == "agent" for a in resp.data["agents"])


@pytest.mark.django_db
def test_category_trends(client: APIClient, agent, ticket):
    auth(client, agent)
    resp = client.get("/api/analytics/category-trends/?days=30")
    assert resp.status_code == 200
    assert "series" in resp.data


@pytest.mark.django_db
def test_sla_view(client: APIClient, agent, ticket):
    auth(client, agent)
    resp = client.get("/api/analytics/sla/")
    assert resp.status_code == 200
    assert set(resp.data["counts"]) == {"breached", "at_risk"}
