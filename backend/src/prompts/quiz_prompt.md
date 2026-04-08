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
- "codeTemplate" must print the final answer directly.
- "expectedStdout" must exactly match the printed output.
- Prefer Python for coding questions unless the topic strongly requires another language.

If you are unsure, still return valid JSON that matches the schema exactly.
