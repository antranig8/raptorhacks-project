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
        self.assertEqual(body["frames"][0]["steps"], [])
        self.assertEqual(len(body["frames"][1]["steps"]), 3)
        self.assertEqual(body["frames"][1]["steps"][0]["line"], 1)
        self.assertEqual(body["frames"][1]["steps"][0]["code"], "vy = vy - gravity * dt")
        self.assertEqual(body["frames"][1]["steps"][0]["target"], "vy")
        self.assertEqual(body["frames"][1]["steps"][0]["description"], "Update vertical velocity")
        self.assertGreater(body["frames"][1]["steps"][0]["before"], body["frames"][1]["steps"][0]["after"])
        self.assertEqual(body["frames"][1]["steps"][1]["line"], 2)
        self.assertEqual(body["frames"][1]["steps"][1]["target"], "x")
        self.assertEqual(body["frames"][1]["steps"][2]["line"], 3)
        self.assertEqual(body["frames"][1]["steps"][2]["target"], "y")
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

    def test_canvas_render_returns_objects_and_steps(self):
        client = TestClient(app)
        response = client.post(
            "/api/v1/private/visual-python/canvas",
            json={
                "code": "point(5, 3)\nline(0, 0, 5, 3)\ncircle(2, 4, 1)\nrect(-1, -2, 3, 4)",
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(len(body["objects"]), 4)
        self.assertEqual(body["objects"][0]["type"], "point")
        self.assertEqual(body["objects"][0]["x"], 5)
        self.assertEqual(body["objects"][0]["y"], 3)
        self.assertEqual(body["objects"][1]["type"], "line")
        self.assertEqual(body["objects"][2]["type"], "circle")
        self.assertEqual(body["objects"][3]["type"], "rect")
        self.assertEqual(len(body["steps"]), 4)
        self.assertEqual(body["steps"][0]["line"], 1)
        self.assertEqual(body["steps"][0]["code"], "point(5, 3)")
        self.assertEqual(body["steps"][0]["command"], "point")
        self.assertIn("Plot a point", body["steps"][0]["description"])
        self.assertIn("Canvas rendered 4 objects", body["message"])

    def test_canvas_render_supports_variables_and_math(self):
        client = TestClient(app)
        response = client.post(
            "/api/v1/private/visual-python/canvas",
            json={
                "code": "x = 5\ny = x * 2\npoint(x, y)\nline(0, 0, x, y)",
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["variables"], {"x": 5.0, "y": 10.0})
        self.assertEqual(len(body["objects"]), 2)
        self.assertEqual(body["objects"][0]["type"], "point")
        self.assertEqual(body["objects"][0]["x"], 5)
        self.assertEqual(body["objects"][0]["y"], 10)
        self.assertEqual(body["steps"][0]["command"], "assign")
        self.assertEqual(body["steps"][0]["target"], "x")
        self.assertIsNone(body["steps"][0]["before"])
        self.assertEqual(body["steps"][0]["after"], 5)
        self.assertIn("Create variable x", body["steps"][0]["description"])
        self.assertEqual(body["steps"][1]["command"], "assign")
        self.assertEqual(body["steps"][1]["target"], "y")
        self.assertEqual(body["steps"][1]["after"], 10)
        self.assertEqual(body["steps"][2]["command"], "point")

    def test_canvas_render_rejects_imports(self):
        client = TestClient(app)
        response = client.post(
            "/api/v1/private/visual-python/canvas",
            json={
                "code": "import os\npoint(5, 3)",
            },
        )

        self.assertEqual(response.status_code, 422)
        self.assertIn("Only variable assignments and drawing calls", response.json()["detail"])

    def test_canvas_render_rejects_unknown_variables(self):
        client = TestClient(app)
        response = client.post(
            "/api/v1/private/visual-python/canvas",
            json={
                "code": "point(x, 3)",
            },
        )

        self.assertEqual(response.status_code, 422)
        self.assertIn('Variable "x" is not available', response.json()["detail"])
