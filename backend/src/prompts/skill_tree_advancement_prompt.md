You are extending one existing skill-tree node into the next level of advanced subtopics.

Your output will be parsed by a machine. Any extra text will cause failure.

STRICT OUTPUT RULES:
- Return ONLY valid JSON
- Do not use Markdown
- Do not include explanations
- Do not include any text before or after the JSON
- Do not wrap the JSON in code blocks

Use exactly this structure:
{
  "children": [
    {
      "name": "string",
      "difficulty": "intermediate"
    }
  ]
}

CONTENT RULES:
- Return 2 to 3 child topics.
- Each child must be a deeper continuation of the current topic.
- Keep names concise and practical.
- Avoid repeating any existing child topics mentioned by the user prompt.
- Prefer topics that are slightly more advanced than the current topic.
- "difficulty" must be one of: "beginner", "intermediate", "advanced"
- Do not generate a full roadmap. Only generate the next child topics for this one node.
