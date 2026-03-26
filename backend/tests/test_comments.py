from fastapi.testclient import TestClient

from conftest import create_and_publish_market
from main import create_app


def test_comments_list_empty_by_default(market_maker_client, admin_client):
    market = create_and_publish_market(market_maker_client, admin_client)

    resp = market_maker_client.get(f"/markets/{market.id}/comments")
    assert resp.status_code == 200

    payload = resp.json()
    assert payload["count"] == 0
    assert payload["items"] == []


def test_create_comment_requires_auth(market_maker_client, admin_client):
    market = create_and_publish_market(market_maker_client, admin_client)

    app = create_app()
    with TestClient(app) as anonymous_client:
        resp = anonymous_client.post(
            f"/markets/{market.id}/comments",
            json={"content": "hello world"},
        )

    assert resp.status_code == 401


def test_nested_comments_and_reactions(user_client, market_maker_client, admin_client):
    market = create_and_publish_market(market_maker_client, admin_client)

    create_root = user_client.post(
        f"/markets/{market.id}/comments",
        json={"content": "Root comment"},
    )
    assert create_root.status_code == 201
    root_comment = create_root.json()

    create_reply = user_client.post(
        f"/markets/{market.id}/comments",
        json={
            "content": "Reply comment",
            "parentCommentId": root_comment["id"],
        },
    )
    assert create_reply.status_code == 201

    react_resp = user_client.post(
        f"/markets/{market.id}/comments/{root_comment['id']}/reactions",
        json={"reaction": "like"},
    )
    assert react_resp.status_code == 200
    assert react_resp.json()["active"] is True

    list_resp = user_client.get(f"/markets/{market.id}/comments")
    assert list_resp.status_code == 200

    payload = list_resp.json()
    assert payload["count"] == 2
    assert len(payload["items"]) == 1

    root = payload["items"][0]
    assert root["content"] == "Root comment"
    assert len(root["replies"]) == 1
    assert root["replies"][0]["content"] == "Reply comment"
    assert root["reactions"][0]["reaction"] == "like"
    assert root["reactions"][0]["count"] == 1

    unreact_resp = user_client.post(
        f"/markets/{market.id}/comments/{root_comment['id']}/reactions",
        json={"reaction": "like"},
    )
    assert unreact_resp.status_code == 200
    assert unreact_resp.json()["active"] is False

    list_after = user_client.get(f"/markets/{market.id}/comments")
    assert list_after.status_code == 200
    root_after = list_after.json()["items"][0]
    assert root_after["reactions"] == []


def test_comments_list_ignores_invalid_token(market_maker_client, admin_client):
    market = create_and_publish_market(market_maker_client, admin_client)

    app = create_app()
    with TestClient(app) as anonymous_client:
        resp = anonymous_client.get(
            f"/markets/{market.id}/comments",
            headers={"Authorization": "Bearer definitely-invalid-token"},
        )

    assert resp.status_code == 200


def test_create_comment_rejects_content_over_limit(
    user_client, market_maker_client, admin_client
):
    market = create_and_publish_market(market_maker_client, admin_client)

    resp = user_client.post(
        f"/markets/{market.id}/comments",
        json={"content": "a" * 1001},
    )

    assert resp.status_code == 422
