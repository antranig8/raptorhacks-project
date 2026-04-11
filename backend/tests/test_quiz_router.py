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
            if "id" not in record:
                record["id"] = len(self.store) + 1
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
        self.quiz_done: list[dict] = []

    def table(self, name: str):
        if name == quiz_router.SKILL_TREES_TABLE:
            return FakeSupabaseQuery(self.skill_trees)
        if name == quiz_router.QUIZ_TABLE:
            return FakeSupabaseQuery(self.quizzes)
        if name == quiz_router.QUIZ_DONE_TABLE:
            return FakeSupabaseQuery(self.quiz_done)
        raise AssertionError(f"Unexpected table: {name}")


class FakeQuizPlatform:
    def __init__(self, response_text: str):
        self.response_text = response_text
        self.calls = 0

    def chat_messages(self, messages, temperature: float, max_tokens: int):
        self.calls += 1
        return self.response_text, None


class FakeAdvancementPlatform(FakeQuizPlatform):
    pass


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
                  "hint": "Think about why functions are named blocks.",
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
        self.assertNotIn("hint", body["questions"][0])
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

    def test_submit_answer_returns_hint_only_after_wrong_answer_when_enabled(self):
        self.fake_supabase.quizzes.append(
            {
                "id": "quiz-hints",
                "user_id": str(self.user.uuid),
                "skill_tree_id": "tree-1",
                "node_id": "functions",
                "title": "Functions Quiz",
                "data": {
                    "allowHints": True,
                    "questions": [
                        {
                            "type": "Single",
                            "prompt": "What does a function do?",
                            "isSkippable": True,
                            "hint": "Think about reusable named blocks of logic.",
                            "choices": [
                                {"id": "A", "label": "Encapsulates reusable logic", "isCorrect": True, "reasoning": "Functions group reusable logic."},
                                {"id": "B", "label": "Deletes variables", "isCorrect": False, "reasoning": "Functions do not delete variables."},
                                {"id": "C", "label": "Makes HTML", "isCorrect": False, "reasoning": "Functions are not HTML-specific."},
                                {"id": "D", "label": "Starts a server", "isCorrect": False, "reasoning": "Functions do not inherently start servers."},
                            ],
                            "expectedStdout": None,
                            "language": None,
                            "codeTemplate": None,
                            "userGuidance": None,
                        }
                    ],
                },
            }
        )

        with patch.object(quiz_router, "supabase_client", self.fake_supabase):
            client = TestClient(app)
            wrong_response = client.post(
                "/api/v1/private/quiz/submit-answer",
                json={
                    "quiz_id": "quiz-hints",
                    "node_id": "functions",
                    "question_index": 0,
                    "answer": "B",
                },
            )
            correct_response = client.post(
                "/api/v1/private/quiz/submit-answer",
                json={
                    "quiz_id": "quiz-hints",
                    "node_id": "functions",
                    "question_index": 0,
                    "answer": "A",
                },
            )

        self.assertEqual(wrong_response.status_code, 200)
        self.assertFalse(wrong_response.json()["correct"])
        self.assertEqual(wrong_response.json()["hint"], "Think about reusable named blocks of logic.")
        self.assertEqual(correct_response.status_code, 200)
        self.assertTrue(correct_response.json()["correct"])
        self.assertIsNone(correct_response.json()["hint"])

    def test_submit_answer_does_not_return_hint_when_not_enabled(self):
        self.fake_supabase.quizzes.append(
            {
                "id": "quiz-hints-disabled",
                "user_id": str(self.user.uuid),
                "skill_tree_id": "tree-1",
                "node_id": "functions",
                "title": "Functions Quiz",
                "data": {
                    "questions": [
                        {
                            "type": "Single",
                            "prompt": "What does a function do?",
                            "isSkippable": True,
                            "hint": "Think about reusable named blocks of logic.",
                            "choices": [
                                {"id": "A", "label": "Encapsulates reusable logic", "isCorrect": True, "reasoning": "Functions group reusable logic."},
                                {"id": "B", "label": "Deletes variables", "isCorrect": False, "reasoning": "Functions do not delete variables."},
                                {"id": "C", "label": "Makes HTML", "isCorrect": False, "reasoning": "Functions are not HTML-specific."},
                                {"id": "D", "label": "Starts a server", "isCorrect": False, "reasoning": "Functions do not inherently start servers."},
                            ],
                            "expectedStdout": None,
                            "language": None,
                            "codeTemplate": None,
                            "userGuidance": None,
                        }
                    ],
                },
            }
        )

        with patch.object(quiz_router, "supabase_client", self.fake_supabase):
            client = TestClient(app)
            response = client.post(
                "/api/v1/private/quiz/submit-answer",
                json={
                    "quiz_id": "quiz-hints-disabled",
                    "node_id": "functions",
                    "question_index": 0,
                    "answer": "B",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["correct"])
        self.assertIsNone(response.json()["hint"])

    def test_generate_creates_freeform_quiz_from_language_and_prompt(self):
        fake_ai = FakeQuizPlatform(
            """
            {
              "questions": [
                {
                  "type": "Single",
                  "prompt": "What does a Rust borrow checker prevent?",
                  "isSkippable": true,
                  "choices": [
                    {"id": "A", "label": "Data races", "isCorrect": true, "reasoning": "Correct."},
                    {"id": "B", "label": "Compilation", "isCorrect": false, "reasoning": "Incorrect."},
                    {"id": "C", "label": "Comments", "isCorrect": false, "reasoning": "Incorrect."},
                    {"id": "D", "label": "Formatting", "isCorrect": false, "reasoning": "Incorrect."}
                  ],
                  "expectedStdout": null,
                  "language": null,
                  "codeTemplate": null,
                  "userGuidance": null
                },
                {
                  "type": "Multiple",
                  "prompt": "Which Rust items can own data?",
                  "isSkippable": true,
                  "choices": [
                    {"id": "A", "label": "String", "isCorrect": true, "reasoning": "Correct."},
                    {"id": "B", "label": "Vec", "isCorrect": true, "reasoning": "Correct."},
                    {"id": "C", "label": "&str", "isCorrect": false, "reasoning": "Incorrect."},
                    {"id": "D", "label": "&[i32]", "isCorrect": false, "reasoning": "Incorrect."}
                  ],
                  "expectedStdout": null,
                  "language": null,
                  "codeTemplate": null,
                  "userGuidance": null
                },
                {
                  "type": "SelectAll",
                  "prompt": "Select valid Rust ownership ideas.",
                  "isSkippable": true,
                  "choices": [
                    {"id": "A", "label": "Moves transfer ownership", "isCorrect": true, "reasoning": "Correct."},
                    {"id": "B", "label": "One mutable reference at a time", "isCorrect": true, "reasoning": "Correct."},
                    {"id": "C", "label": "Garbage collection is required", "isCorrect": false, "reasoning": "Incorrect."},
                    {"id": "D", "label": "Borrowing avoids taking ownership", "isCorrect": true, "reasoning": "Correct."}
                  ],
                  "expectedStdout": null,
                  "language": null,
                  "codeTemplate": null,
                  "userGuidance": null
                },
                {
                  "type": "Coding",
                  "prompt": "Return the sum.",
                  "isSkippable": false,
                  "choices": [],
                  "expectedStdout": "3",
                  "language": "rust",
                  "codeTemplate": "fn main() { let x = 1; let y = 2; println!(\\\"{}\\\", %s); }",
                  "userGuidance": "Write one expression that adds x and y."
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
                "/api/v1/private/quiz/generate",
                json={"language": "rust", "prompt": "ownership basics"},
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["skill_tree_id"], quiz_router.MOCK_SKILL_TREE_ID)
        self.assertTrue(body["node_id"].startswith("freeform-"))
        self.assertEqual(body["title"], "rust Quiz")
        self.assertEqual(body["questions"][3]["language"], "rust")
        self.assertEqual(len(self.fake_supabase.quizzes), 1)
        self.assertEqual(self.fake_supabase.quizzes[0]["title"], "rust Quiz")
        self.assertEqual(fake_ai.calls, 1)

    def test_generate_rejects_coding_question_with_wrong_language(self):
        fake_ai = FakeQuizPlatform(
            """
            {
              "questions": [
                {
                  "type": "Single",
                  "prompt": "What does Rust emphasize?",
                  "isSkippable": true,
                  "choices": [
                    {"id": "A", "label": "Safety", "isCorrect": true, "reasoning": "Correct."},
                    {"id": "B", "label": "Inheritance", "isCorrect": false, "reasoning": "Incorrect."},
                    {"id": "C", "label": "Macros only", "isCorrect": false, "reasoning": "Incorrect."},
                    {"id": "D", "label": "Reflection", "isCorrect": false, "reasoning": "Incorrect."}
                  ],
                  "expectedStdout": null,
                  "language": null,
                  "codeTemplate": null,
                  "userGuidance": null
                },
                {
                  "type": "Multiple",
                  "prompt": "Pick Rust ownership ideas.",
                  "isSkippable": true,
                  "choices": [
                    {"id": "A", "label": "Moves", "isCorrect": true, "reasoning": "Correct."},
                    {"id": "B", "label": "Borrowing", "isCorrect": true, "reasoning": "Correct."},
                    {"id": "C", "label": "GC only", "isCorrect": false, "reasoning": "Incorrect."},
                    {"id": "D", "label": "Manual headers", "isCorrect": false, "reasoning": "Incorrect."}
                  ],
                  "expectedStdout": null,
                  "language": null,
                  "codeTemplate": null,
                  "userGuidance": null
                },
                {
                  "type": "SelectAll",
                  "prompt": "Select valid Rust concepts.",
                  "isSkippable": true,
                  "choices": [
                    {"id": "A", "label": "Traits", "isCorrect": true, "reasoning": "Correct."},
                    {"id": "B", "label": "Enums", "isCorrect": true, "reasoning": "Correct."},
                    {"id": "C", "label": "Classes", "isCorrect": false, "reasoning": "Incorrect."},
                    {"id": "D", "label": "Lifetimes", "isCorrect": true, "reasoning": "Correct."}
                  ],
                  "expectedStdout": null,
                  "language": null,
                  "codeTemplate": null,
                  "userGuidance": null
                },
                {
                  "type": "Coding",
                  "prompt": "Return the sum.",
                  "isSkippable": false,
                  "choices": [],
                  "expectedStdout": "3",
                  "language": "python",
                  "codeTemplate": "print(%s)",
                  "userGuidance": "Write one expression that evaluates to 3."
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
                "/api/v1/private/quiz/generate",
                json={"language": "rust", "prompt": "ownership basics"},
            )

        self.assertEqual(response.status_code, 502)
        self.assertIn('requested language "rust"', response.json()["detail"])
        self.assertEqual(len(self.fake_supabase.quizzes), 0)

    def test_generate_hard_mode_disables_hints_even_when_requested(self):
        fake_ai = FakeQuizPlatform(
            """
            {
              "questions": [
                {
                  "type": "Single",
                  "prompt": "What does Rust emphasize?",
                  "isSkippable": true,
                  "hint": "Think about compile-time memory guarantees.",
                  "choices": [
                    {"id": "A", "label": "Safety", "isCorrect": true, "reasoning": "Rust emphasizes memory safety."},
                    {"id": "B", "label": "Inheritance", "isCorrect": false, "reasoning": "Rust does not center inheritance."},
                    {"id": "C", "label": "Macros only", "isCorrect": false, "reasoning": "Rust has more than macros."},
                    {"id": "D", "label": "Reflection", "isCorrect": false, "reasoning": "Rust does not center reflection."}
                  ],
                  "expectedStdout": null,
                  "language": null,
                  "codeTemplate": null,
                  "userGuidance": null
                },
                {
                  "type": "Multiple",
                  "prompt": "Pick Rust ownership ideas.",
                  "isSkippable": true,
                  "hint": "Look for concepts tied to ownership transfer and borrowing.",
                  "choices": [
                    {"id": "A", "label": "Moves", "isCorrect": true, "reasoning": "Moves transfer ownership."},
                    {"id": "B", "label": "Borrowing", "isCorrect": true, "reasoning": "Borrowing references data."},
                    {"id": "C", "label": "GC only", "isCorrect": false, "reasoning": "Rust avoids mandatory GC."},
                    {"id": "D", "label": "Manual headers", "isCorrect": false, "reasoning": "Headers are not ownership."}
                  ],
                  "expectedStdout": null,
                  "language": null,
                  "codeTemplate": null,
                  "userGuidance": null
                },
                {
                  "type": "SelectAll",
                  "prompt": "Select valid Rust concepts.",
                  "isSkippable": true,
                  "hint": "Choose language features Rust actually uses.",
                  "choices": [
                    {"id": "A", "label": "Traits", "isCorrect": true, "reasoning": "Traits define shared behavior."},
                    {"id": "B", "label": "Enums", "isCorrect": true, "reasoning": "Enums model variants."},
                    {"id": "C", "label": "Classes", "isCorrect": false, "reasoning": "Rust has structs, not classes."},
                    {"id": "D", "label": "Lifetimes", "isCorrect": true, "reasoning": "Lifetimes track references."}
                  ],
                  "expectedStdout": null,
                  "language": null,
                  "codeTemplate": null,
                  "userGuidance": null
                },
                {
                  "type": "Coding",
                  "prompt": "Return the sum.",
                  "isSkippable": false,
                  "hint": "Use the two numeric variables in the print expression.",
                  "choices": [],
                  "expectedStdout": "3",
                  "language": "rust",
                  "codeTemplate": "fn main() { let x = 1; let y = 2; println!(\\\"{}\\\", %s); }",
                  "userGuidance": "Write one expression that adds x and y."
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
                "/api/v1/private/quiz/generate",
                json={
                    "language": "rust",
                    "prompt": "ownership basics",
                    "allow_hints": True,
                    "hard_mode": True,
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(self.fake_supabase.quizzes[0]["data"]["allowHints"])

    def test_submit_unlocks_advanced_branch_and_records_exp(self):
        self.fake_supabase.quizzes.append(
            {
                "id": "00000000-0000-0000-0000-000000000003",
                "user_id": str(self.user.uuid),
                "skill_tree_id": "tree-1",
                "node_id": "functions",
                "title": "Functions Quiz",
                "data": {
                    "questions": [
                        {
                            "type": "Single",
                            "prompt": "Q1",
                            "isSkippable": True,
                            "choices": [
                                {"id": "A", "label": "A", "isCorrect": True, "reasoning": "Correct."},
                                {"id": "B", "label": "B", "isCorrect": False, "reasoning": "Incorrect."},
                                {"id": "C", "label": "C", "isCorrect": False, "reasoning": "Incorrect."},
                                {"id": "D", "label": "D", "isCorrect": False, "reasoning": "Incorrect."},
                            ],
                        },
                        {
                            "type": "Single",
                            "prompt": "Q2",
                            "isSkippable": True,
                            "choices": [
                                {"id": "A", "label": "A", "isCorrect": True, "reasoning": "Correct."},
                                {"id": "B", "label": "B", "isCorrect": False, "reasoning": "Incorrect."},
                                {"id": "C", "label": "C", "isCorrect": False, "reasoning": "Incorrect."},
                                {"id": "D", "label": "D", "isCorrect": False, "reasoning": "Incorrect."},
                            ],
                        },
                        {
                            "type": "Single",
                            "prompt": "Q3",
                            "isSkippable": True,
                            "choices": [
                                {"id": "A", "label": "A", "isCorrect": True, "reasoning": "Correct."},
                                {"id": "B", "label": "B", "isCorrect": False, "reasoning": "Incorrect."},
                                {"id": "C", "label": "C", "isCorrect": False, "reasoning": "Incorrect."},
                                {"id": "D", "label": "D", "isCorrect": False, "reasoning": "Incorrect."},
                            ],
                        },
                        {
                            "type": "Single",
                            "prompt": "Q4",
                            "isSkippable": True,
                            "choices": [
                                {"id": "A", "label": "A", "isCorrect": True, "reasoning": "Correct."},
                                {"id": "B", "label": "B", "isCorrect": False, "reasoning": "Incorrect."},
                                {"id": "C", "label": "C", "isCorrect": False, "reasoning": "Incorrect."},
                                {"id": "D", "label": "D", "isCorrect": False, "reasoning": "Incorrect."},
                            ],
                        },
                    ]
                },
            }
        )

        fake_advancement = FakeAdvancementPlatform(
            """
            {
              "children": [
                {"name": "Closures", "difficulty": "intermediate"},
                {"name": "Decorators", "difficulty": "advanced"}
              ]
            }
            """
        )

        with patch.object(quiz_router, "supabase_client", self.fake_supabase), patch.object(
            quiz_router, "advancement_platform", fake_advancement
        ), patch.object(quiz_router, "insert_exp_event"), patch.object(
            quiz_router, "insert_quiz_complete_event"
        ):
            client = TestClient(app)
            response = client.post(
                "/api/v1/private/quiz/submit",
                json={
                    "quiz_id": "00000000-0000-0000-0000-000000000003",
                    "node_id": "functions",
                    "answers": [
                        {"quiz_id": "00000000-0000-0000-0000-000000000003", "node_id": "functions", "question_index": 0, "answer": "A"},
                        {"quiz_id": "00000000-0000-0000-0000-000000000003", "node_id": "functions", "question_index": 1, "answer": "A"},
                        {"quiz_id": "00000000-0000-0000-0000-000000000003", "node_id": "functions", "question_index": 2, "answer": "A"},
                        {"quiz_id": "00000000-0000-0000-0000-000000000003", "node_id": "functions", "question_index": 3, "answer": "A"},
                    ],
                },
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["exp_gained"], 100)
        self.assertEqual(body["total_node_xp"], 100)
        self.assertTrue(body["branch_unlocked"])
        self.assertEqual(len(body["unlocked_children"]), 2)
        self.assertEqual(len(self.fake_supabase.quiz_done), 1)
        updated_tree = self.fake_supabase.skill_trees[0]["tree_json"]
        updated_node = updated_tree["children"][0]
        self.assertEqual(updated_node["metadata"]["xp"], 100)
        self.assertEqual(updated_node["metadata"]["advancement_count"], 1)
        self.assertEqual(len(updated_node["children"]), 2)

    def test_submit_does_not_unlock_after_three_advancements(self):
        self.fake_supabase.skill_trees[0]["tree_json"]["children"][0]["metadata"] = {
            "xp": 300,
            "unlock_threshold_xp": 100,
            "advancement_count": 3,
            "max_advancements": 3,
            "branch_history": ["advancement-1", "advancement-2", "advancement-3"],
            "analytics": {"total_exp_earned": 300},
        }
        self.fake_supabase.quizzes.append(
            {
                "id": "00000000-0000-0000-0000-000000000004",
                "user_id": str(self.user.uuid),
                "skill_tree_id": "tree-1",
                "node_id": "functions",
                "title": "Functions Quiz",
                "data": {
                    "questions": [
                        {
                            "type": "Single",
                            "prompt": "Q1",
                            "isSkippable": True,
                            "choices": [
                                {"id": "A", "label": "A", "isCorrect": True, "reasoning": "Correct."},
                                {"id": "B", "label": "B", "isCorrect": False, "reasoning": "Incorrect."},
                                {"id": "C", "label": "C", "isCorrect": False, "reasoning": "Incorrect."},
                                {"id": "D", "label": "D", "isCorrect": False, "reasoning": "Incorrect."},
                            ],
                        }
                    ]
                },
            }
        )
        fake_advancement = FakeAdvancementPlatform('{"children":[{"name":"Ignored","difficulty":"advanced"},{"name":"Ignored Two","difficulty":"advanced"}]}')

        with patch.object(quiz_router, "supabase_client", self.fake_supabase), patch.object(
            quiz_router, "advancement_platform", fake_advancement
        ), patch.object(quiz_router, "insert_exp_event"), patch.object(
            quiz_router, "insert_quiz_complete_event"
        ):
            client = TestClient(app)
            response = client.post(
                "/api/v1/private/quiz/submit",
                json={
                    "quiz_id": "00000000-0000-0000-0000-000000000004",
                    "node_id": "functions",
                    "answers": [
                        {"quiz_id": "00000000-0000-0000-0000-000000000004", "node_id": "functions", "question_index": 0, "answer": "A"},
                    ],
                },
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["exp_gained"], 25)
        self.assertEqual(body["total_node_xp"], 325)
        self.assertFalse(body["branch_unlocked"])
        self.assertEqual(fake_advancement.calls, 0)
