from __future__ import annotations

from uuid import UUID
from unittest import TestCase
from unittest.mock import patch

from fastapi.testclient import TestClient

from src.auth import auth as auth_module
from src.auth import throttling as throttling_module
from src.auth.user import User
from src.main import app
from src.router import quiz as quiz_router


class FakeResponse:
    def __init__(self, data):
        self.data = data


class FakeSupabaseQuery:
    def __init__(self, store: list[dict]):
        self.store = store
        self.filters: list[tuple[str, object]] = []
        self.payload: dict | None = None
        self.update_payload: dict | None = None
        self.limit_value: int | None = None

    def select(self, _columns: str):
        return self

    def eq(self, column: str, value: object):
        self.filters.append((column, value))
        return self

    def limit(self, value: int):
        self.limit_value = value
        return self

    def insert(self, payload: dict):
        self.payload = payload
        return self

    def update(self, payload: dict):
        self.update_payload = payload
        return self

    def execute(self):
        if self.payload is not None:
            record = dict(self.payload)
            self.store.append(record)
            return FakeResponse([record])

        if self.update_payload is not None:
            updated_records = []
            for record in self.store:
                if all(record.get(column) == value for column, value in self.filters):
                    record.update(self.update_payload)
                    updated_records.append(dict(record))
            return FakeResponse(updated_records)

        results = [
            record for record in self.store
            if all(record.get(column) == value for column, value in self.filters)
        ]
        if self.limit_value is not None:
            results = results[:self.limit_value]
        return FakeResponse(results)


class FakeSupabaseClient:
    def __init__(self):
        self.skill_trees: list[dict] = []
        self.quizzes: list[dict] = []

    def table(self, name: str):
        if name == quiz_router.SKILL_TREES_TABLE:
            return FakeSupabaseQuery(self.skill_trees)
        if name == quiz_router.QUIZ_TABLE:
            return FakeSupabaseQuery(self.quizzes)
        raise AssertionError(f"Unexpected table: {name}")


class FakeQuizPlatform:
    def __init__(self, response_text: str):
        self.response_text = response_text
        self.calls = 0

    def chat_messages(self, messages, temperature: float, max_tokens: int):
        self.calls += 1
        return self.response_text, None


class FakePistonOutput:
    def __init__(self, stdout: str):
        self.error = None
        self.language = "python"
        self.compile_stage = None
        self.run_stage = type(
            "RunStage",
            (),
            {"code": 0, "stdout": stdout, "output": stdout},
        )()


class FakePiston:
    async def test_code(self, language: str, code: str):
        return FakePistonOutput("hello\r\n")


class QuizRouterTests(TestCase):
    def setUp(self):
        self.user = User(
            uuid=UUID("00000000-0000-0000-0000-000000000001"),
            username="quiz-user",
            email="quiz@example.com",
        )
        self.fake_supabase = FakeSupabaseClient()
        self.fake_supabase.skill_trees.append(
            {
                "id": "tree-1",
                "user_id": str(self.user.uuid),
                "goal": "Learn Python",
                "title": "Python Roadmap",
                "tree_json": {
                    "id": "learn-python",
                    "name": "Learn Python",
                    "children": [
                        {
                            "id": "functions",
                            "name": "Functions",
                            "difficulty": "beginner",
                            "children": [],
                        }
                    ],
                },
            }
        )
        app.dependency_overrides[auth_module.get_current_user] = lambda: self.user
        app.dependency_overrides[throttling_module.rate_limit_authenticated] = lambda: True

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_by_node_creates_and_returns_sanitized_quiz(self):
        fake_ai = FakeQuizPlatform(
            """
            {
              "questions": [
                {
                  "type": "Single",
                  "prompt": "What does a function do?",
                  "isSkippable": true,
                  "choices": [
                    {"id": "A", "label": "Encapsulates reusable logic", "isCorrect": true, "reasoning": "Correct."},
                    {"id": "B", "label": "Deletes variables", "isCorrect": false, "reasoning": "Incorrect."},
                    {"id": "C", "label": "Makes HTML", "isCorrect": false, "reasoning": "Incorrect."},
                    {"id": "D", "label": "Starts a server", "isCorrect": false, "reasoning": "Incorrect."}
                  ],
                  "expectedStdout": null,
                  "language": null,
                  "codeTemplate": null,
                  "userGuidance": null
                },
                {
                  "type": "Multiple",
                  "prompt": "Which are function benefits?",
                  "isSkippable": true,
                  "choices": [
                    {"id": "A", "label": "Reuse", "isCorrect": true, "reasoning": "Correct."},
                    {"id": "B", "label": "Readability", "isCorrect": true, "reasoning": "Correct."},
                    {"id": "C", "label": "Randomness", "isCorrect": false, "reasoning": "Incorrect."},
                    {"id": "D", "label": "Latency", "isCorrect": false, "reasoning": "Incorrect."}
                  ],
                  "expectedStdout": null,
                  "language": null,
                  "codeTemplate": null,
                  "userGuidance": null
                },
                {
                  "type": "SelectAll",
                  "prompt": "Select valid function parts.",
                  "isSkippable": true,
                  "choices": [
                    {"id": "A", "label": "Name", "isCorrect": true, "reasoning": "Correct."},
                    {"id": "B", "label": "Parameters", "isCorrect": true, "reasoning": "Correct."},
                    {"id": "C", "label": "Magic", "isCorrect": false, "reasoning": "Incorrect."},
                    {"id": "D", "label": "Return value", "isCorrect": true, "reasoning": "Correct."}
                  ],
                  "expectedStdout": null,
                  "language": null,
                  "codeTemplate": null,
                  "userGuidance": null
                },
                {
                  "type": "Coding",
                  "prompt": "Print hello.",
                  "isSkippable": false,
                  "choices": [],
                  "expectedStdout": "hello",
                  "language": "python",
                  "codeTemplate": "%s",
                  "userGuidance": "print('hello')"
                }
              ]
            }
            """
        )

        with patch.object(quiz_router, "supabase_client", self.fake_supabase), patch.object(
            quiz_router, "quiz_platform", fake_ai
        ):
            client = TestClient(app)
            response = client.post(
                "/api/v1/private/quiz/by-node",
                json={"skill_tree_id": "tree-1", "node_id": "functions"},
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["skill_tree_id"], "tree-1")
        self.assertEqual(body["node_id"], "functions")
        self.assertTrue(body["quiz_id"])
        self.assertEqual(body["questions"][0]["choices"][0], {"id": "A", "label": "Encapsulates reusable logic"})
        self.assertNotIn("isCorrect", body["questions"][0]["choices"][0])
        self.assertEqual(len(self.fake_supabase.quizzes), 1)
        self.assertEqual(self.fake_supabase.quizzes[0]["node_id"], "functions")
        self.assertEqual(fake_ai.calls, 1)

    def test_by_node_reuses_saved_quiz_without_regenerating(self):
        self.fake_supabase.quizzes.append(
            {
                "id": "quiz-1",
                "user_id": str(self.user.uuid),
                "skill_tree_id": "tree-1",
                "node_id": "functions",
                "title": "Functions Quiz",
                "data": {
                    "questions": [
                        {
                            "type": "Single",
                            "prompt": "Saved question",
                            "isSkippable": True,
                            "choices": [
                                {"id": "A", "label": "Answer", "isCorrect": True, "reasoning": "Correct."}
                            ],
                            "expectedStdout": None,
                            "language": None,
                            "codeTemplate": None,
                            "userGuidance": None,
                        }
                    ]
                },
            }
        )
        fake_ai = FakeQuizPlatform('{"questions": []}')

        with patch.object(quiz_router, "supabase_client", self.fake_supabase), patch.object(
            quiz_router, "quiz_platform", fake_ai
        ):
            client = TestClient(app)
            response = client.post(
                "/api/v1/private/quiz/by-node",
                json={"skill_tree_id": "tree-1", "node_id": "functions"},
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["quiz_id"], "quiz-1")
        self.assertEqual(body["questions"][0]["prompt"], "Saved question")
        self.assertEqual(fake_ai.calls, 0)

    def test_submit_answer_normalizes_coding_output(self):
        self.fake_supabase.quizzes.append(
            {
                "id": "quiz-2",
                "user_id": str(self.user.uuid),
                "skill_tree_id": "tree-1",
                "node_id": "functions",
                "title": "Functions Quiz",
                "data": {
                    "questions": [
                        {
                            "type": "Coding",
                            "prompt": "Print hello",
                            "isSkippable": False,
                            "choices": [],
                            "expectedStdout": "hello\n",
                            "language": "python",
                            "codeTemplate": "%s",
                            "userGuidance": "print('hello')",
                        }
                    ]
                },
            }
        )

        with patch.object(quiz_router, "supabase_client", self.fake_supabase), patch.object(
            quiz_router, "piston", FakePiston()
        ):
            client = TestClient(app)
            response = client.post(
                "/api/v1/private/quiz/submit-answer",
                json={
                    "quiz_id": "quiz-2",
                    "node_id": "functions",
                    "question_index": 0,
                    "answer": "print('hello')",
                },
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["correct"])
        self.assertIsNone(body["error"])
