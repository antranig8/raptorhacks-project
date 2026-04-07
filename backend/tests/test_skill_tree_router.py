from __future__ import annotations

import json
from uuid import UUID
from unittest import TestCase
from unittest.mock import patch

from fastapi.testclient import TestClient

from src.auth import auth as auth_module
from src.auth import throttling as throttling_module
from src.auth.user import User
from src.main import app
from src.router import skill_tree as skill_tree_router


class FakeResponse:
    def __init__(self, data):
        self.data = data


class FakeSupabaseTable:
    def __init__(self, store: list[dict]):
        self.store = store
        self._payload = None

    def insert(self, payload: dict):
        self._payload = payload
        return self

    def execute(self):
        record = {
            "id": "tree-1",
            "user_id": self._payload["user_id"],
            "goal": self._payload["goal"],
            "title": self._payload["title"],
            "tree_json": self._payload["tree_json"],
            "completed_node_ids": self._payload.get("completed_node_ids", []),
            "is_active": False,
            "created_at": "2026-04-07T12:00:00Z",
            "updated_at": "2026-04-07T12:00:00Z",
        }
        self.store.append(record)
        return FakeResponse([record])


class FakeSupabaseClient:
    def __init__(self):
        self.skill_trees: list[dict] = []

    def table(self, name: str):
        assert name == skill_tree_router.SKILL_TREES_TABLE
        return FakeSupabaseTable(self.skill_trees)


class FakeAIPlatform:
    def __init__(self, response_text: str):
        self.response_text = response_text
        self.messages = None

    def chat_messages(self, messages, temperature: float, max_tokens: int):
        self.messages = messages
        return self.response_text, None


class SkillTreeRouterTests(TestCase):
    def setUp(self):
        self.user = User(
            uuid=UUID("00000000-0000-0000-0000-000000000001"),
            username="user-one",
            email="one@example.com",
        )
        self.fake_supabase = FakeSupabaseClient()
        app.dependency_overrides[auth_module.get_current_user] = lambda: self.user
        app.dependency_overrides[throttling_module.rate_limit_authenticated] = lambda: True

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_create_tree_accepts_name_and_goal_and_returns_generated_tree(self):
        fake_ai = FakeAIPlatform(
            json.dumps(
                {
                    "goal": "Learn Python",
                    "skills": [
                        {
                            "name": "Basics",
                            "subskills": [
                                {"name": "Syntax", "difficulty": "beginner"},
                                {"name": "Variables", "difficulty": "beginner"},
                            ],
                        },
                        {
                            "name": "Control Flow",
                            "subskills": [
                                {"name": "Conditionals", "difficulty": "beginner"},
                                {"name": "Loops", "difficulty": "beginner"},
                            ],
                        },
                        {
                            "name": "Projects",
                            "subskills": [
                                {"name": "CLI App", "difficulty": "intermediate"},
                                {"name": "Automation", "difficulty": "intermediate"},
                            ],
                        },
                    ],
                }
            )
        )

        with patch.object(skill_tree_router, "supabase_client", self.fake_supabase), patch.object(
            skill_tree_router, "get_ai_platform", return_value=fake_ai
        ):
            client = TestClient(app)
            response = client.post(
                "/api/v1/private/skill-trees",
                json={"name": "Python Roadmap", "goal": "Learn Python"},
            )

        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(body["name"], "Python Roadmap")
        self.assertEqual(body["goal"], "Learn Python")
        self.assertEqual(body["completed_node_ids"], [])
        self.assertFalse(body["is_active"])
        self.assertEqual(body["tree"]["name"], "Learn Python")
        self.assertIsNotNone(body["tree"]["id"])
        self.assertEqual(len(body["tree"]["children"]), 3)
        child_ids = [child["id"] for child in body["tree"]["children"]]
        self.assertEqual(len(child_ids), len(set(child_ids)))
        self.assertEqual(self.fake_supabase.skill_trees[0]["title"], "Python Roadmap")
        self.assertEqual(fake_ai.messages[-1]["content"], "Learn Python")

    def test_create_tree_still_accepts_legacy_title_field(self):
        fake_ai = FakeAIPlatform(
            json.dumps(
                {
                    "goal": "Learn FastAPI",
                    "skills": [
                        {
                            "name": "HTTP",
                            "subskills": [
                                {"name": "Methods", "difficulty": "beginner"},
                                {"name": "Status Codes", "difficulty": "beginner"},
                            ],
                        },
                        {
                            "name": "FastAPI",
                            "subskills": [
                                {"name": "Routes", "difficulty": "beginner"},
                                {"name": "Dependencies", "difficulty": "intermediate"},
                            ],
                        },
                        {
                            "name": "Deployment",
                            "subskills": [
                                {"name": "ASGI", "difficulty": "intermediate"},
                                {"name": "Env Vars", "difficulty": "beginner"},
                            ],
                        },
                    ],
                }
            )
        )

        with patch.object(skill_tree_router, "supabase_client", self.fake_supabase), patch.object(
            skill_tree_router, "get_ai_platform", return_value=fake_ai
        ):
            client = TestClient(app)
            response = client.post(
                "/api/v1/private/skill-trees",
                json={"title": "Backend API", "goal": "Learn FastAPI"},
            )

        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(body["name"], "Backend API")
        self.assertEqual(body["tree"]["name"], "Learn FastAPI")
        self.assertIsNotNone(body["tree"]["id"])
