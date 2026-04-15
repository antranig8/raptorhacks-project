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
        self._filters: list[tuple[str, object]] = []
        self._updates = None
        self._delete_requested = False
        self._order_column = None
        self._order_desc = False

    def select(self, _columns: str):
        return self

    def eq(self, column: str, value: object):
        self._filters.append((column, value))
        return self

    def order(self, column: str, desc: bool = False):
        self._order_column = column
        self._order_desc = desc
        return self

    def insert(self, payload: dict):
        self._payload = payload
        return self

    def update(self, payload: dict):
        self._updates = payload
        return self

    def delete(self):
        self._delete_requested = True
        return self

    def execute(self):
        if self._payload is not None:
            record = {
                "id": f"tree-{len(self.store) + 1}",
                "user_id": self._payload["user_id"],
                "goal": self._payload["goal"],
                "title": self._payload["title"],
                "tree_json": self._payload["tree_json"],
                "completed_node_ids": self._payload.get("completed_node_ids", []),
                "is_active": self._payload.get("is_active", False),
                "created_at": "2026-04-07T12:00:00Z",
                "updated_at": "2026-04-07T12:00:00Z",
            }
            self.store.append(record)
            return FakeResponse([record])

        matching_records = [
            record for record in self.store
            if all(record.get(column) == value for column, value in self._filters)
        ]

        if self._delete_requested:
            deleted = [dict(record) for record in matching_records]
            self.store[:] = [record for record in self.store if record not in matching_records]
            return FakeResponse(deleted)

        if self._updates is not None:
            updated_records = []
            for record in matching_records:
                record.update(self._updates)
                updated_records.append(dict(record))
            return FakeResponse(updated_records)

        ordered_records = [dict(record) for record in matching_records]
        if self._order_column:
            ordered_records.sort(key=lambda record: record.get(self._order_column), reverse=self._order_desc)
        return FakeResponse(ordered_records)


class FakeSupabaseClient:
    def __init__(self):
        self.skill_trees: list[dict] = []

    def table(self, name: str):
        assert name == skill_tree_router.SKILL_TREES_TABLE
        return FakeSupabaseTable(self.skill_trees)


class FakeAIPlatform:
    def __init__(self, response_text: str | list[str]):
        # Support one or many mocked AI responses so tests can simulate multi-step flows.
        if isinstance(response_text, list):
            self.response_queue = list(response_text)
        else:
            self.response_queue = [response_text]
        self.messages = []

    def chat_messages(self, messages, temperature: float, max_tokens: int):
        self.messages.append(messages)
        if not self.response_queue:
            raise AssertionError("No fake AI responses left in the queue.")
        return self.response_queue.pop(0), None


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
        self.assertTrue(body["is_active"])
        self.assertEqual(body["tree"]["name"], "Learn Python")
        self.assertIsNotNone(body["tree"]["id"])
        self.assertEqual(len(body["tree"]["children"]), 3)
        child_ids = [child["id"] for child in body["tree"]["children"]]
        self.assertEqual(len(child_ids), len(set(child_ids)))
        self.assertEqual(self.fake_supabase.skill_trees[0]["title"], "Python Roadmap")
        self.assertEqual(fake_ai.messages[-1][-1]["content"], "Learn Python")

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

    def test_create_tree_accepts_prompt_and_normalizes_goal_before_generation(self):
        fake_ai = FakeAIPlatform(
            [
                json.dumps({"goal": "Improve C programming for systems programming"}),
                json.dumps(
                    {
                        "goal": "Improve C programming for systems programming",
                        "skills": [
                            {
                                "name": "C Fundamentals",
                                "subskills": [
                                    {"name": "Types", "difficulty": "beginner"},
                                    {"name": "Pointers", "difficulty": "beginner"},
                                ],
                            },
                            {
                                "name": "Memory",
                                "subskills": [
                                    {"name": "Stack vs Heap", "difficulty": "beginner"},
                                    {"name": "Manual Allocation", "difficulty": "intermediate"},
                                ],
                            },
                            {
                                "name": "Systems Practice",
                                "subskills": [
                                    {"name": "File I/O", "difficulty": "intermediate"},
                                    {"name": "Debugging", "difficulty": "intermediate"},
                                ],
                            },
                        ],
                    }
                ),
            ]
        )

        with patch.object(skill_tree_router, "supabase_client", self.fake_supabase), patch.object(
            skill_tree_router, "get_ai_platform", return_value=fake_ai
        ):
            client = TestClient(app)
            response = client.post(
                "/api/v1/private/skill-trees",
                json={
                    "name": "C Roadmap",
                    "prompt": "I want to get better at C for systems programming.",
                },
            )

        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(body["goal"], "Improve C programming for systems programming")
        self.assertEqual(body["tree"]["name"], "Improve C programming for systems programming")
        self.assertEqual(len(fake_ai.messages), 2)
        self.assertEqual(fake_ai.messages[0][-1]["content"], "I want to get better at C for systems programming.")
        self.assertEqual(fake_ai.messages[1][-1]["content"], "Improve C programming for systems programming")

    def test_create_tree_marks_new_tree_active_and_clears_previous_active_tree(self):
        self.fake_supabase.skill_trees.append(
            {
                "id": "tree-1",
                "user_id": str(self.user.uuid),
                "goal": "Learn Python",
                "title": "Python Roadmap",
                "tree_json": {"id": "python", "name": "Learn Python", "children": []},
                "completed_node_ids": [],
                "is_active": True,
                "created_at": "2026-04-07T12:00:00Z",
                "updated_at": "2026-04-07T12:00:00Z",
            }
        )
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
                json={"name": "API Roadmap", "goal": "Learn FastAPI"},
            )

        self.assertEqual(response.status_code, 201)
        self.assertFalse(self.fake_supabase.skill_trees[0]["is_active"])
        self.assertTrue(self.fake_supabase.skill_trees[1]["is_active"])
        self.assertTrue(response.json()["is_active"])

    def test_update_tree_marks_only_one_tree_active(self):
        self.fake_supabase.skill_trees.extend(
            [
                {
                    "id": "tree-1",
                    "user_id": str(self.user.uuid),
                    "goal": "Learn Python",
                    "title": "Python Roadmap",
                    "tree_json": {"id": "python", "name": "Learn Python", "children": []},
                    "completed_node_ids": [],
                    "is_active": True,
                    "created_at": "2026-04-07T12:00:00Z",
                    "updated_at": "2026-04-07T12:00:00Z",
                },
                {
                    "id": "tree-2",
                    "user_id": str(self.user.uuid),
                    "goal": "Learn FastAPI",
                    "title": "API Roadmap",
                    "tree_json": {"id": "fastapi", "name": "Learn FastAPI", "children": []},
                    "completed_node_ids": [],
                    "is_active": False,
                    "created_at": "2026-04-08T12:00:00Z",
                    "updated_at": "2026-04-08T12:00:00Z",
                },
            ]
        )

        with patch.object(skill_tree_router, "supabase_client", self.fake_supabase):
            client = TestClient(app)
            response = client.patch(
                "/api/v1/private/skill-trees/tree-2",
                json={"is_active": True},
            )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(self.fake_supabase.skill_trees[0]["is_active"])
        self.assertTrue(self.fake_supabase.skill_trees[1]["is_active"])

    def test_delete_tree_removes_saved_plan(self):
        self.fake_supabase.skill_trees.append(
            {
                "id": "tree-1",
                "user_id": str(self.user.uuid),
                "goal": "Learn Python",
                "title": "Python Roadmap",
                "tree_json": {"id": "python", "name": "Learn Python", "children": []},
                "completed_node_ids": [],
                "is_active": False,
                "created_at": "2026-04-07T12:00:00Z",
                "updated_at": "2026-04-07T12:00:00Z",
            }
        )

        with patch.object(skill_tree_router, "supabase_client", self.fake_supabase):
            client = TestClient(app)
            response = client.delete("/api/v1/private/skill-trees/tree-1")

        self.assertEqual(response.status_code, 204)
        self.assertEqual(self.fake_supabase.skill_trees, [])
