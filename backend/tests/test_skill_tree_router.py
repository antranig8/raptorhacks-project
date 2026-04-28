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
from src.services import learn as learn_service
from src.services.skill_tree import parse_skill_tree_response


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
        self._limit_count = None

    def select(self, _columns: str):
        return self

    def eq(self, column: str, value: object):
        self._filters.append((column, value))
        return self

    def order(self, column: str, desc: bool = False):
        self._order_column = column
        self._order_desc = desc
        return self

    def limit(self, count: int):
        self._limit_count = count
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
            if "lesson" in self._payload:
                record = {
                    "id": f"lesson-{len(self.store) + 1}",
                    **self._payload,
                    "created_at": "2026-04-07T12:00:00Z",
                    "updated_at": "2026-04-07T12:00:00Z",
                }
            else:
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
        if self._limit_count is not None:
            ordered_records = ordered_records[:self._limit_count]
        return FakeResponse(ordered_records)


class FakeSupabaseClient:
    def __init__(self):
        self.skill_trees: list[dict] = []
        self.learn_lessons: list[dict] = []

    def table(self, name: str):
        if name == skill_tree_router.SKILL_TREES_TABLE:
            return FakeSupabaseTable(self.skill_trees)
        if name == skill_tree_router.LEARN_LESSONS_TABLE:
            return FakeSupabaseTable(self.learn_lessons)
        raise AssertionError(f"Unexpected table: {name}")


class FakeAIPlatform:
    def __init__(self, response_text: str | list[str]):
        # Support one or many mocked AI responses so tests can simulate multi-step flows.
        if isinstance(response_text, list):
            self.response_queue = list(response_text)
        else:
            self.response_queue = [response_text]
        self.messages = []
        self.max_tokens_calls: list[int] = []

    def chat_messages(self, messages, temperature: float, max_tokens: int):
        self.messages.append(messages)
        self.max_tokens_calls.append(max_tokens)
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
        self.assertEqual(fake_ai.max_tokens_calls, [skill_tree_router.SKILL_TREE_GENERATION_MAX_TOKENS])

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

    def test_parse_skill_tree_response_recovers_json_from_wrapped_text(self):
        raw_response = """
I will return the tree now.
{
  "goal": "Learn Python",
  "skills": [
    {
      "name": "Basics",
      "subskills": [
        {"name": "Variables", "difficulty": "beginner"},
        {"name": "Loops", "difficulty": "beginner"}
      ]
    },
    {
      "name": "Projects",
      "subskills": [
        {"name": "CLI App", "difficulty": "intermediate"},
        {"name": "Files", "difficulty": "intermediate"}
      ]
    },
    {
      "name": "Debugging",
      "subskills": [
        {"name": "Tracebacks", "difficulty": "beginner"},
        {"name": "Breakpoints", "difficulty": "intermediate"}
      ]
    }
  ]
}
extra footer with {not json}
"""

        tree = parse_skill_tree_response(raw_response)

        self.assertEqual(tree.goal, "Learn Python")
        self.assertEqual(tree.skills[0].name, "Basics")

    def test_parse_skill_tree_response_removes_partial_think_prefix(self):
        raw_response = (
            '<think>I need to build the tree.\n\n'
            '{"goal":"Learn Python","skills":['
            '{"name":"Basics","subskills":['
            '{"name":"Variables","difficulty":"beginner"},'
            '{"name":"Loops","difficulty":"beginner"}]},'
            '{"name":"Functions","subskills":['
            '{"name":"Parameters","difficulty":"beginner"},'
            '{"name":"Return Values","difficulty":"beginner"}]},'
            '{"name":"Projects","subskills":['
            '{"name":"CLI App","difficulty":"intermediate"},'
            '{"name":"Debugging","difficulty":"intermediate"}]}]}'
        )

        tree = parse_skill_tree_response(raw_response)

        self.assertEqual(tree.goal, "Learn Python")
        self.assertEqual(tree.skills[1].name, "Functions")

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

    def test_create_tree_restores_previous_active_tree_when_insert_fails(self):
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

        original_execute_query = skill_tree_router.execute_query
        insert_seen = False

        async def failing_execute_query(query):
            nonlocal insert_seen
            if getattr(query, "_payload", None) is not None and "lesson" not in query._payload:
                insert_seen = True
                raise RuntimeError("insert failed")
            return await original_execute_query(query)

        with patch.object(skill_tree_router, "supabase_client", self.fake_supabase), patch.object(
            skill_tree_router, "get_ai_platform", return_value=fake_ai
        ), patch.object(skill_tree_router, "execute_query", side_effect=failing_execute_query):
            client = TestClient(app)
            response = client.post(
                "/api/v1/private/skill-trees",
                json={"name": "API Roadmap", "goal": "Learn FastAPI"},
            )

        self.assertTrue(insert_seen)
        self.assertEqual(response.status_code, 500)
        self.assertEqual(len(self.fake_supabase.skill_trees), 1)
        self.assertTrue(self.fake_supabase.skill_trees[0]["is_active"])

    def test_update_tree_restores_previous_active_tree_when_target_update_fails(self):
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

        original_execute_query = skill_tree_router.execute_query

        async def failing_execute_query(query):
            if (
                getattr(query, "_updates", None) is not None
                and query._updates.get("is_active") is True
                and ("id", "tree-2") in getattr(query, "_filters", [])
            ):
                raise RuntimeError("target update failed")
            return await original_execute_query(query)

        with patch.object(skill_tree_router, "supabase_client", self.fake_supabase), patch.object(
            skill_tree_router, "execute_query", side_effect=failing_execute_query
        ):
            client = TestClient(app)
            response = client.patch(
                "/api/v1/private/skill-trees/tree-2",
                json={"is_active": True},
            )

        self.assertEqual(response.status_code, 500)
        self.assertTrue(self.fake_supabase.skill_trees[0]["is_active"])
        self.assertFalse(self.fake_supabase.skill_trees[1]["is_active"])

    def test_get_learn_lesson_returns_cached_lesson_for_owned_tree(self):
        self.fake_supabase.skill_trees.append(
            {
                "id": "00000000-0000-0000-0000-000000000111",
                "user_id": str(self.user.uuid),
                "goal": "Learn C",
                "title": "C Roadmap",
                "tree_json": {"id": "c", "name": "Learn C", "children": []},
                "completed_node_ids": [],
                "is_active": True,
                "created_at": "2026-04-07T12:00:00Z",
                "updated_at": "2026-04-07T12:00:00Z",
            }
        )
        self.fake_supabase.learn_lessons.append(
            {
                "id": "lesson-1",
                "user_id": str(self.user.uuid),
                "skill_tree_id": "00000000-0000-0000-0000-000000000111",
                "node_id": "variables",
                "tree_title": "C Roadmap",
                "node_title": "Variables",
                "difficulty": "beginner",
                "version": 1,
                "lesson": {
                    "version": 1,
                    "title": "C Variables",
                    "meaning": "A variable is a named place in memory that stores a value.",
                    "whyItMatters": "Variables let programs remember and reuse information.",
                    "example": {
                        "language": "c",
                        "code": "int score = 100;",
                        "explanation": "This creates an integer variable named score.",
                    },
                    "keyTakeaways": [
                        "A variable has a name.",
                        "A variable stores a value.",
                    ],
                    "commonMistake": {
                        "mistake": "Using a variable before assigning it.",
                        "explanation": "In C, uninitialized variables can contain unpredictable data.",
                    },
                },
            }
        )

        with patch.object(skill_tree_router, "supabase_client", self.fake_supabase):
            client = TestClient(app)
            response = client.post(
                "/api/v1/private/skill-trees/00000000-0000-0000-0000-000000000111/learn",
                json={
                    "node_id": "variables",
                    "tree_title": "C Roadmap",
                    "node_title": "Variables",
                    "difficulty": "beginner",
                },
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["source"], "cache")
        self.assertEqual(body["lesson"]["title"], "C Variables")
        self.assertEqual(body["lesson"]["example"]["language"], "c")

    def test_get_learn_lesson_generates_and_caches_lesson_when_missing(self):
        self.fake_supabase.skill_trees.append(
            {
                "id": "00000000-0000-0000-0000-000000000222",
                "user_id": str(self.user.uuid),
                "goal": "Learn C",
                "title": "C Roadmap",
                "tree_json": {"id": "c", "name": "Learn C", "children": []},
                "completed_node_ids": [],
                "is_active": True,
                "created_at": "2026-04-07T12:00:00Z",
                "updated_at": "2026-04-07T12:00:00Z",
            }
        )
        fake_ai = FakeAIPlatform(
            json.dumps(
                {
                    "title": "C Variables",
                    "meaning": "A variable is a named place in memory that stores a value.",
                    "whyItMatters": "Variables let programs remember and reuse information.",
                    "example": {
                        "language": "c",
                        "code": "int score = 100;",
                        "explanation": "This creates an integer variable named score.",
                    },
                    "keyTakeaways": [
                        "A variable has a name.",
                        "A variable stores a value.",
                    ],
                    "commonMistake": {
                        "mistake": "Using a variable before assigning it.",
                        "explanation": "In C, uninitialized variables can contain unpredictable data.",
                    },
                }
            )
        )

        with patch.object(skill_tree_router, "supabase_client", self.fake_supabase), patch.object(
            skill_tree_router, "get_ai_platform", return_value=fake_ai
        ):
            client = TestClient(app)
            response = client.post(
                "/api/v1/private/skill-trees/00000000-0000-0000-0000-000000000222/learn",
                json={
                    "node_id": "variables",
                    "tree_title": "C Roadmap",
                    "node_title": "Variables",
                },
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["source"], "ai")
        self.assertEqual(body["lesson"]["version"], 1)
        self.assertEqual(body["lesson"]["title"], "C Variables")
        self.assertEqual(len(self.fake_supabase.learn_lessons), 1)
        self.assertEqual(self.fake_supabase.learn_lessons[0]["node_id"], "variables")
        self.assertEqual(self.fake_supabase.learn_lessons[0]["lesson"]["title"], "C Variables")
        self.assertEqual(fake_ai.max_tokens_calls, [learn_service.LEARN_LESSON_MAX_TOKENS])
        self.assertIn("Skill tree: C Roadmap", fake_ai.messages[0][1]["content"])
        self.assertIn("Clicked node: Variables", fake_ai.messages[0][1]["content"])

    def test_get_learn_lesson_force_regenerate_updates_cached_lesson(self):
        self.fake_supabase.skill_trees.append(
            {
                "id": "00000000-0000-0000-0000-000000000223",
                "user_id": str(self.user.uuid),
                "goal": "Learn C",
                "title": "C Roadmap",
                "tree_json": {"id": "c", "name": "Learn C", "children": []},
                "completed_node_ids": [],
                "is_active": True,
                "created_at": "2026-04-07T12:00:00Z",
                "updated_at": "2026-04-07T12:00:00Z",
            }
        )
        self.fake_supabase.learn_lessons.append(
            {
                "id": "lesson-1",
                "user_id": str(self.user.uuid),
                "skill_tree_id": "00000000-0000-0000-0000-000000000223",
                "node_id": "variables",
                "tree_title": "C Roadmap",
                "node_title": "Variables",
                "difficulty": "beginner",
                "version": 1,
                "lesson": {
                    "version": 1,
                    "title": "Old Variables",
                    "meaning": "Old cached lesson.",
                    "whyItMatters": "Old reason.",
                    "example": {
                        "language": "c",
                        "code": "int old_value = 0;",
                        "explanation": "Old example.",
                    },
                    "keyTakeaways": ["Old takeaway."],
                    "commonMistake": {
                        "mistake": "Old mistake.",
                        "explanation": "Old explanation.",
                    },
                },
            }
        )
        fake_ai = FakeAIPlatform(
            json.dumps(
                {
                    "title": "Fresh C Variables",
                    "meaning": "A variable is a named storage location for a value.",
                    "whyItMatters": "Variables make programs remember and reuse state.",
                    "example": {
                        "language": "c",
                        "code": "int score = 100;",
                        "explanation": "This stores 100 in a variable named score.",
                    },
                    "keyTakeaways": ["Variables have names.", "Variables hold values."],
                    "commonMistake": {
                        "mistake": "Reading an uninitialized variable.",
                        "explanation": "C does not automatically give local variables a safe value.",
                    },
                }
            )
        )

        with patch.object(skill_tree_router, "supabase_client", self.fake_supabase), patch.object(
            skill_tree_router, "get_ai_platform", return_value=fake_ai
        ):
            client = TestClient(app)
            response = client.post(
                "/api/v1/private/skill-trees/00000000-0000-0000-0000-000000000223/learn",
                json={
                    "node_id": "variables",
                    "tree_title": "C Roadmap",
                    "node_title": "Variables",
                    "difficulty": "beginner",
                    "force_regenerate": True,
                },
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["source"], "ai")
        self.assertEqual(body["lesson"]["title"], "Fresh C Variables")
        self.assertEqual(len(self.fake_supabase.learn_lessons), 1)
        self.assertEqual(self.fake_supabase.learn_lessons[0]["lesson"]["title"], "Fresh C Variables")

    def test_get_learn_lesson_returns_502_when_ai_returns_invalid_json(self):
        self.fake_supabase.skill_trees.append(
            {
                "id": "00000000-0000-0000-0000-000000000333",
                "user_id": str(self.user.uuid),
                "goal": "Learn C",
                "title": "C Roadmap",
                "tree_json": {"id": "c", "name": "Learn C", "children": []},
                "completed_node_ids": [],
                "is_active": True,
                "created_at": "2026-04-07T12:00:00Z",
                "updated_at": "2026-04-07T12:00:00Z",
            }
        )
        fake_ai = FakeAIPlatform("not json")

        with patch.object(skill_tree_router, "supabase_client", self.fake_supabase), patch.object(
            skill_tree_router, "get_ai_platform", return_value=fake_ai
        ):
            client = TestClient(app)
            response = client.post(
                "/api/v1/private/skill-trees/00000000-0000-0000-0000-000000000333/learn",
                json={
                    "node_id": "variables",
                    "tree_title": "C Roadmap",
                    "node_title": "Variables",
                },
            )

        self.assertEqual(response.status_code, 502)
        self.assertIn("AI returned invalid JSON", response.json()["detail"])
        self.assertEqual(self.fake_supabase.learn_lessons, [])

    def test_get_learn_lesson_returns_502_when_ai_schema_is_invalid(self):
        self.fake_supabase.skill_trees.append(
            {
                "id": "00000000-0000-0000-0000-000000000444",
                "user_id": str(self.user.uuid),
                "goal": "Learn C",
                "title": "C Roadmap",
                "tree_json": {"id": "c", "name": "Learn C", "children": []},
                "completed_node_ids": [],
                "is_active": True,
                "created_at": "2026-04-07T12:00:00Z",
                "updated_at": "2026-04-07T12:00:00Z",
            }
        )
        fake_ai = FakeAIPlatform(json.dumps({"title": "Incomplete"}))

        with patch.object(skill_tree_router, "supabase_client", self.fake_supabase), patch.object(
            skill_tree_router, "get_ai_platform", return_value=fake_ai
        ):
            client = TestClient(app)
            response = client.post(
                "/api/v1/private/skill-trees/00000000-0000-0000-0000-000000000444/learn",
                json={
                    "node_id": "variables",
                    "tree_title": "C Roadmap",
                    "node_title": "Variables",
                },
            )

        self.assertEqual(response.status_code, 502)
        self.assertIn("did not match the Learn lesson schema", response.json()["detail"])
        self.assertEqual(self.fake_supabase.learn_lessons, [])

    def test_get_learn_lesson_extracts_json_from_wrapped_ai_response(self):
        self.fake_supabase.skill_trees.append(
            {
                "id": "00000000-0000-0000-0000-000000000555",
                "user_id": str(self.user.uuid),
                "goal": "Learn C",
                "title": "C Roadmap",
                "tree_json": {"id": "c", "name": "Learn C", "children": []},
                "completed_node_ids": [],
                "is_active": True,
                "created_at": "2026-04-07T12:00:00Z",
                "updated_at": "2026-04-07T12:00:00Z",
            }
        )
        wrapped_json = """
Here is the lesson:
```json
{
  "title": "C Blocks",
  "meaning": "A block groups statements between braces.",
  "whyItMatters": "Blocks control scope and organize code.",
  "example": {
    "language": "c",
    "code": "if (ready) {\\n    printf(\\"go\\");\\n}",
    "explanation": "The braces group the printf statement inside the if."
  },
  "keyTakeaways": ["Blocks use braces.", "Blocks group statements."],
  "commonMistake": {
    "mistake": "Forgetting a closing brace.",
    "explanation": "The compiler cannot tell where the block ends."
  }
}
```
"""
        fake_ai = FakeAIPlatform(wrapped_json)

        with patch.object(skill_tree_router, "supabase_client", self.fake_supabase), patch.object(
            skill_tree_router, "get_ai_platform", return_value=fake_ai
        ):
            client = TestClient(app)
            response = client.post(
                "/api/v1/private/skill-trees/00000000-0000-0000-0000-000000000555/learn",
                json={
                    "node_id": "blocks",
                    "tree_title": "C Roadmap",
                    "node_title": "Blocks",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["lesson"]["title"], "C Blocks")
        self.assertEqual(len(self.fake_supabase.learn_lessons), 1)

    def test_get_learn_lesson_normalizes_common_ai_wrapper_shape(self):
        self.fake_supabase.skill_trees.append(
            {
                "id": "00000000-0000-0000-0000-000000000777",
                "user_id": str(self.user.uuid),
                "goal": "Learn Algebra",
                "title": "Algebra Roadmap",
                "tree_json": {"id": "algebra", "name": "Learn Algebra", "children": []},
                "completed_node_ids": [],
                "is_active": True,
                "created_at": "2026-04-07T12:00:00Z",
                "updated_at": "2026-04-07T12:00:00Z",
            }
        )
        fake_ai = FakeAIPlatform(
            json.dumps(
                {
                    "lesson": {
                        "name": "Solving Linear Equations",
                        "description": "A linear equation has a variable raised only to the first power.",
                        "why_it_matters": "Linear equations model simple unknown values.",
                        "example": {
                            "subject": "math",
                            "content": "x + 3 = 8, so x = 5",
                            "description": "Subtract 3 from both sides to isolate x.",
                        },
                        "key_takeaways": [
                            "Keep both sides balanced.",
                            "Undo operations to isolate the variable.",
                        ],
                        "common_mistake": {
                            "title": "Changing only one side.",
                            "description": "Whatever you do to one side must also happen to the other side.",
                        },
                    }
                }
            )
        )

        with patch.object(skill_tree_router, "supabase_client", self.fake_supabase), patch.object(
            skill_tree_router, "get_ai_platform", return_value=fake_ai
        ):
            client = TestClient(app)
            response = client.post(
                "/api/v1/private/skill-trees/00000000-0000-0000-0000-000000000777/learn",
                json={
                    "node_id": "linear-equations",
                    "tree_title": "Algebra Roadmap",
                    "node_title": "Linear Equations",
                    "difficulty": "beginner",
                },
            )

        self.assertEqual(response.status_code, 200)
        lesson = response.json()["lesson"]
        self.assertEqual(lesson["title"], "Solving Linear Equations")
        self.assertEqual(lesson["whyItMatters"], "Linear equations model simple unknown values.")
        self.assertEqual(lesson["example"]["language"], "math")
        self.assertEqual(lesson["commonMistake"]["mistake"], "Changing only one side.")

    def test_get_learn_lesson_removes_partial_think_prefix(self):
        self.fake_supabase.skill_trees.append(
            {
                "id": "00000000-0000-0000-0000-000000000666",
                "user_id": str(self.user.uuid),
                "goal": "Learn C",
                "title": "C Roadmap",
                "tree_json": {"id": "c", "name": "Learn C", "children": []},
                "completed_node_ids": [],
                "is_active": True,
                "created_at": "2026-04-07T12:00:00Z",
                "updated_at": "2026-04-07T12:00:00Z",
            }
        )
        fake_ai = FakeAIPlatform(
            '<think>I need to produce JSON.\n\n'
            '{"title":"C Variables","meaning":"A variable stores a value.",'
            '"whyItMatters":"Variables let code reuse information.",'
            '"example":{"language":"c","code":"int score = 100;","explanation":"This stores 100 in score."},'
            '"keyTakeaways":["Variables have names.","Variables store values."],'
            '"commonMistake":{"mistake":"Using a variable before assigning it.",'
            '"explanation":"The value may be unpredictable."}}'
        )

        with patch.object(skill_tree_router, "supabase_client", self.fake_supabase), patch.object(
            skill_tree_router, "get_ai_platform", return_value=fake_ai
        ):
            client = TestClient(app)
            response = client.post(
                "/api/v1/private/skill-trees/00000000-0000-0000-0000-000000000666/learn",
                json={
                    "node_id": "variables",
                    "tree_title": "C Roadmap",
                    "node_title": "Variables",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["lesson"]["title"], "C Variables")

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
