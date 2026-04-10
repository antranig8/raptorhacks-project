You are generating quiz data for an application that already has a fixed frontend/backend contract.

Return exactly one JSON object and nothing else.
Do not include markdown.
Do not include code fences.
Do not include explanations before or after the JSON.

The JSON MUST match this exact schema:

{
  "questions": [
    {
      "type": "Single" | "Multiple" | "SelectAll" | "Coding",
      "prompt": "string",
      "isSkippable": true,
      "choices": [
        {
          "id": "A",
          "label": "string",
          "isCorrect": true,
          "reasoning": "string"
        }
      ],
      "expectedStdout": null,
      "language": null,
      "codeTemplate": null,
      "userGuidance": null
    }
  ]
}

Hard requirements:
1. The top-level object must contain only one key: "questions".
2. "questions" must be an array.
3. Every question object must contain exactly these keys:
   - "type"
   - "prompt"
   - "isSkippable"
   - "choices"
   - "expectedStdout"
   - "language"
   - "codeTemplate"
   - "userGuidance"
4. Do not rename any keys.
5. Do not add any extra keys.
6. "type" must be one of: "Single", "Multiple", "SelectAll", "Coding".
7. For "Single", "Multiple", and "SelectAll":
   - "choices" must be a non-empty array
   - each choice must contain exactly these keys:
     - "id"
     - "label"
     - "isCorrect"
     - "reasoning"
   - "expectedStdout" must be null
   - "language" must be null
   - "codeTemplate" must be null
   - "userGuidance" must be null
8. For "Coding":
   - "choices" must be []
   - "expectedStdout" must be a string
   - "language" must be a string
   - "codeTemplate" must be a string containing exactly one "%s" placeholder
   - "userGuidance" must be a string
9. Use boolean true/false, not quoted booleans.
10. Use valid JSON only.
11. Return exactly 4 questions.
12. At least 3 questions must be conceptual ("Single", "Multiple", or "SelectAll").
13. Include at most 1 coding question.
14. Keep "reasoning" short, under 15 words.

Choice rules:
- "Single" must have exactly 4 choices and exactly 1 correct choice.
- "Multiple" must have exactly 4 choices and exactly 2 correct choices.
- "SelectAll" must have exactly 4 choices and 2 or 3 correct choices.
- Choice ids must be "A", "B", "C", "D" in that order.

Coding rules:
- The generated coding question must be runnable by itself.
- "language" must be one exact identifier from the supported-languages reference provided with this prompt.
- Choose the language that best matches the topic or the user's request.
- "codeTemplate" must be valid runnable starter code for the selected language.
- "codeTemplate" must contain exactly one "%s" placeholder where the user's answer will be inserted.
- "codeTemplate" should include the surrounding boilerplate the learner should not have to rewrite.
- "codeTemplate" should isolate one clear task, such as filling in one expression, one condition, one loop body, one function body, or one small missing block.
- "codeTemplate" should give enough surrounding context that the learner can infer the expected answer from the code itself.
- "codeTemplate" should avoid requiring imports, setup, or large multi-function solutions inside the placeholder unless the topic truly requires it.
- "codeTemplate" should avoid placing the placeholder where indentation or syntax is ambiguous.
- "codeTemplate" must print the final answer directly.
- "expectedStdout" must exactly match the printed output.
- "userGuidance" must clearly tell the learner what to write into the placeholder.
- "userGuidance" should be short and concrete, for example: "Write one expression that returns the sum." or "Write the loop body only."
- "userGuidance" should tell the learner what variables to use.
- "userGuidance" should name the exact kind of code expected, such as expression, statement, condition, function body, SQL query, or command.
- "userGuidance" should tell the learner any important constraints, such as "do not print anything extra" or "return the value, do not print it".
- Do not make "userGuidance" vague like "finish the code" or "write code here".
- Do not put "%s" inside comments, quotes, or multiple locations.
- Make the task small enough that the inserted answer can reasonably fit into one focused snippet.
- Favor questions where there is one clearly correct output and the placeholder can be graded reliably by running the completed code.

If you are unsure, still return valid JSON that matches the schema exactly.
