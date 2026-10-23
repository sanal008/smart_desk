import pytest
from rest_framework.test import APIClient

from tests.conftest import auth


@pytest.mark.django_db
def test_register_and_me(client: APIClient):
    resp = client.post(
        "/api/auth/register/",
        {
            "username": "newbie",
            "email": "n@example.com",
            "password": "S3cure-passw0rd!",
            "first_name": "New",
            "last_name": "User",
        },
        format="json",
    )
    assert resp.status_code == 201
    assert "access" in resp.data and "refresh" in resp.data
    assert resp.data["user"]["role"] == "CUSTOMER"

    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")
    me = client.get("/api/auth/me/")
    assert me.status_code == 200
    assert me.data["username"] == "newbie"


@pytest.mark.django_db
def test_login_returns_user_profile(client: APIClient, customer):
    resp = client.post(
        "/api/auth/login/", {"username": "cust", "password": "pass"}, format="json"
    )
    assert resp.status_code == 200
    assert resp.data["user"]["username"] == "cust"
    assert "access" in resp.data


@pytest.mark.django_db
def test_customer_cannot_list_users(client: APIClient, customer, agent):
    auth(client, customer)
    assert client.get("/api/auth/users/").status_code == 403


@pytest.mark.django_db
def test_agent_can_list_users(client: APIClient, agent, customer):
    auth(client, agent)
    resp = client.get("/api/auth/users/")
    assert resp.status_code == 200
    usernames = {u["username"] for u in resp.data["results"]}
    assert "agent" in usernames


@pytest.mark.django_db
def test_teams_visible_to_authenticated_users(client: APIClient, customer, teams):
    auth(client, customer)
    resp = client.get("/api/auth/teams/")
    assert resp.status_code == 200
    assert resp.data["count"] >= 5
