Return one minified JSON object. No markdown, no fences, no explanation before or after.

Schema:
{"questions":[{"type":"Single|Multiple|SelectAll|Coding","prompt":"string","isSkippable":true,"choices":[{"id":"A","label":"string","isCorrect":true,"reasoning":"string"}],"expectedStdout":null,"language":null,"codeTemplate":null,"userGuidance":null}]}

GLOBAL RULES
- Top-level key: "questions" only.
- Every question has exactly: type, prompt, isSkippable, choices, expectedStdout, language, codeTemplate, userGuidance.
- type: "Single" | "Multiple" | "SelectAll" | "Coding".
- Booleans: true/false, not strings.
- Exactly 4 questions. At least 3 conceptual. At most 1 Coding.

CONCEPTUAL QUESTIONS (Single/Multiple/SelectAll)
- choices: non-empty array of {id,label,isCorrect,reasoning}.
- expectedStdout/language/codeTemplate/userGuidance: all null.
- Choice ids: "A","B","C","D" in order.
- Single: 4 choices, 1 correct. Multiple: 4 choices, 2 correct. SelectAll: 4 choices, 2-3 correct.
- reasoning: name the specific concept/rule that makes this choice right or wrong. Under 15 words. Never write "Correct." or "Incorrect." or any variant — always state the actual reason.

CODING QUESTIONS
- choices: []. expectedStdout/language/codeTemplate/userGuidance: all non-null strings.
- language: exact identifier from the Supported Languages list below. No aliases, no invented names.
- codeTemplate: runnable code with exactly one "%s" placeholder (not inside a comment or string). Boilerplate included. One focused task. Completed code must print exactly expectedStdout.
- userGuidance: state (1) what kind of code to write, (2) which variables are available, (3) what it should produce, (4) constraints. Never write "Finish the code" or similar.
- Do not write a Coding question if the topic is git, shell commands, package managers, GUIs, or anything without deterministic sandboxable stdout. Use a conceptual question instead.