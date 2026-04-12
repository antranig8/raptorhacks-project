from __future__ import annotations

from unittest import TestCase
from uuid import UUID

from fastapi.testclient import TestClient

from src.auth import auth as auth_module
from src.auth import throttling as throttling_module
from src.auth.user import User
from src.main import app


class VisualPythonRouterTests(TestCase):
    def setUp(self):
        self.user = User(
            uuid=UUID("00000000-0000-0000-0000-000000000010"),
            username="visual-python-user",
            email="visual-python@example.com",
        )
        app.dependency_overrides[auth_module.get_current_user] = lambda: self.user
        app.dependency_overrides[throttling_module.rate_limit_authenticated] = lambda: True

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_projectile_simulation_returns_frames(self):
        client = TestClient(app)
        response = client.post(
            "/api/v1/private/visual-python/projectile",
            json={
                "setup": {
                    "gravity": 9.8,
                    "speed": 20,
                    "angle": 45,
                    "dt": 0.05,
                    "max_steps": 30,
                },
                "update_code": "vy = vy - gravity * dt\nx = x + vx * dt\ny = y + vy * dt",
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertGreater(len(body["frames"]), 2)
        self.assertEqual(body["frames"][0]["x"], 0)
        self.assertGreater(body["frames"][1]["x"], body["frames"][0]["x"])
        self.assertIn("Simulation ran", body["message"])

    def test_projectile_simulation_rejects_imports(self):
        client = TestClient(app)
        response = client.post(
            "/api/v1/private/visual-python/projectile",
            json={
                "setup": {},
                "update_code": "import os\nx = x + vx * dt",
            },
        )

        self.assertEqual(response.status_code, 422)
        self.assertIn("Only assignment lines", response.json()["detail"])
