from fastapi import APIRouter, Depends, HTTPException

from ..auth.throttling import rate_limit_chat
from ..dependencies.ai import get_ai_platform
from ..schemas.ai import ChatRequest, ChatResponse, ChatMessage, SkillTreeGenerateRequest, SkillTreeResponse
from ..services.prompts import load_prompt
from ..services.skill_tree import (
    build_skill_tree_user_prompt,
    generated_tree_to_node,
    load_skill_tree_system_prompt,
    parse_skill_tree_response,
    resolve_skill_tree_goal,
)

router = APIRouter()
SKILL_TREE_GENERATION_MAX_TOKENS = 1250


@router.post("/chat", response_model=ChatResponse, dependencies=[Depends(rate_limit_chat)])
async def chat(request: ChatRequest):
    ai_platform = get_ai_platform()
    chat_prompt = load_prompt("chat_prompt.md")
    messages = [message.model_dump() for message in request.messages]

    if chat_prompt and not any(message["role"] == "system" for message in messages):
        messages = [{"role": "system", "content": chat_prompt}, *messages]

    try:
        response_text, usage = ai_platform.chat_messages(
            messages,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail="AI provider request failed.") from exc

    return ChatResponse(
        message=ChatMessage(role="assistant", content=response_text),
        usage=usage,
    )


@router.post("/skill-tree/generate", response_model=SkillTreeResponse, dependencies=[Depends(rate_limit_chat)])
async def generate_skill_tree(request: SkillTreeGenerateRequest):
    # Reuse the shared AI client so this route can ask Groq to build a roadmap.
    ai_platform = get_ai_platform()
    # Resolve the final goal from whichever input shape the client sent.
    try:
        resolved_goal = resolve_skill_tree_goal(ai_platform, request.goal, request.prompt)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    # Load the system instructions that tell the model what JSON shape to return.
    system_prompt = load_skill_tree_system_prompt()
    messages = []

    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})

    # The normalized goal becomes the main prompt, for example "Learn Python for engineering".
    messages.append({"role": "user", "content": build_skill_tree_user_prompt(resolved_goal)})

    try:
        # Ask the model for a structured skill tree, then validate that the response is usable JSON.
        response_text, _ = ai_platform.chat_messages(
            messages,
            temperature=0.2,
            max_tokens=SKILL_TREE_GENERATION_MAX_TOKENS,
        )
        generated_tree = parse_skill_tree_response(response_text)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="AI provider request failed.") from exc

    # Convert the validated model output into the tree node format the frontend can render.
    return SkillTreeResponse(tree=generated_tree_to_node(generated_tree))
