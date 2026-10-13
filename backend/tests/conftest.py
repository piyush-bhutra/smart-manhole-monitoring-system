import pytest

from app import create_app
from app.models import Node, db


@pytest.fixture
def app(tmp_path):
    application = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///" + str(tmp_path / "test.db"),
                              "DEMO_ENABLED": True})
    with application.app_context():
        db.create_all()
        db.session.add(Node(id="HW-001", name="Hardware test node", location_description="Test bench", is_demo=False))
        db.session.commit()
        yield application
        db.session.remove()
        db.engine.dispose()


@pytest.fixture
def client(app):
    return app.test_client()
