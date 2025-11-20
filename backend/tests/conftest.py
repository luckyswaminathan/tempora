import os
import sys
import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timezone
from dotenv import load_dotenv

# TODO: figure out how to get rid of this ugly stuff
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from main import create_app
from api import deps
from schemas.user import UserBase
from supabase import create_client

# Load test env
load_dotenv(".env.test")
TEST_DB_URL = os.environ["SUPABASE_URL"]
TEST_DB_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
TEST_USER_EMAIL = os.environ["TEST_USER_EMAIL"]
TEST_USER_PASSWORD = os.environ["TEST_USER_PASSWORD"]


@pytest.fixture(scope="session")
def test_supabase():
    """
    Create Supabase client for test environment.
    """
    return create_client(TEST_DB_URL, TEST_DB_KEY)


@pytest.fixture(scope="session")
def test_user(test_supabase):
    """
    Create and return a fake test user for authentication purposes.
    """
    existing_users = test_supabase.auth.admin.list_users()
    for user in existing_users:
        test_supabase.auth.admin.delete_user(user.id)

    created = test_supabase.auth.admin.create_user(
        {
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD,
            "email_confirm": True,
            "user_metadata": {"full_name": "Test User"},
        }
    )
    user = created.user

    return UserBase(
        id=user.id,
        email=TEST_USER_EMAIL,
        displayName=user.user_metadata["full_name"],
        createdAt=user.created_at,
    )


@pytest.fixture(scope="session")
def client(test_supabase, test_user):
    """
    FastAPI test client using your create_app().
    """
    app = create_app()

    # Bypass production database and user authentication
    app.dependency_overrides[deps.get_supabase_client] = lambda: test_supabase
    app.dependency_overrides[deps.get_current_user] = lambda: test_user

    return TestClient(app)


@pytest.fixture(autouse=True)
def reset_db(test_supabase):
    """
    Clears the database before every test.
    """
    TABLES = ["trades", "securities", "markets", "profiles"]
    for table in TABLES:
        test_supabase.table(table).delete().not_.is_("id", "null").execute()
    yield
