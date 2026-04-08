import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import ValidationError
from supabase import PostgrestAPIError
from ..schemas.quiz import Quiz, QuizAnswer, QuizCreateRequest, QuizAnswerCodeResponse, QuizQuestion
from ..auth.user import User
from ..auth.auth import get_current_user
from ..dependencies.ai import quiz_platform
from ..auth.supabase import client as supabase_client
from ..piston.piston import piston
import json

router = APIRouter()

QUIZ_TABLE = "quizzes"


async def _get_coding_question_from_db(id: str, question_number: int):
    try:
        quiz = (
            supabase_client.table(QUIZ_TABLE)
            .select("id, data")
            .eq("id", id)
            .execute()
        )        
    except Exception as exc:
        raise _handle_supabase_error(exc)

    if not quiz.data:
        raise HTTPException(status_code=500, detail="Quiz was not created.")
    
    questions = quiz.data[0]['data']['questions']
    if questions[question_number]['type'] != "Coding":
        raise HTTPException(status_code=500, detail="Question type is not Coding.")
    
    return QuizQuestion(**questions[question_number])

def _parse_quiz_from_str(text: str):
    try:
        # The AI is expected to return JSON, not free-form text.
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError("AI returned invalid JSON for skill tree generation. (%s)", text) from exc

    try:
        # Validate the JSON shape before the API returns anything to the frontend.
        return Quiz.model_validate(payload)
    except ValidationError as exc:
        raise ValueError("AI returned JSON that did not match the skill tree schema. (%s)", text) from exc

def _handle_supabase_error(exc: Exception) -> HTTPException:
    # Convert lower-level storage errors into API-friendly HTTP errors.
    if isinstance(exc, PostgrestAPIError):
        return HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Supabase request failed: {exc.message}",
        )

    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=("Quiz storage failed.", exc),
    )

def _generate_quiz(prompt: str):
    try:
        response_text = quiz_platform.chat(prompt, temperature=0.2, max_tokens=3000)
        generated_quiz = _parse_quiz_from_str(response_text)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI provider request failed. " + str(exc)) from exc

    return generated_quiz

@router.post('/answer-code/', response_model=QuizAnswerCodeResponse, status_code=status.HTTP_200_OK)
async def test_code_for_quiz(request: QuizAnswer,
                             current_user: User = Depends(get_current_user)):
    answer = request.answer
    question = await _get_coding_question_from_db(request.quiz_id, request.question_index)
    if question.type != "Coding":
        raise HTTPException(status_code=status.HTTP_406_NOT_ACCEPTABLE, detail="Question type is not coding.")
    output = await piston.test_code(question.language, question.codeTemplate % answer)
    if output.compile_stage and output.compile_stage.code != 0:
        return QuizAnswerCodeResponse(error=output.compile_stage.output)
    if output.run_stage.code != 0:
        return QuizAnswerCodeResponse(error=output.run_stage.output)
    if output.run_stage.stdout != question.expectedStdout:
        return QuizAnswerCodeResponse(error=f"Outputs are different. {output.run_stage.stdout} != {question.expectedStdout}")
    return QuizAnswerCodeResponse()
    

@router.post('/create/', response_model=Quiz, status_code=status.HTTP_201_CREATED)
async def create_quiz(request: QuizCreateRequest,
    current_user: User = Depends(get_current_user)):
    quiz = _generate_quiz(request.prompt)

    payload = {
        "data": quiz.model_dump(),
    }

    try:
        response = (
            supabase_client.table(QUIZ_TABLE)
            .insert(payload)
            .execute()
        )
    except Exception as exc:
        raise _handle_supabase_error(exc)

    if not response.data:
        raise HTTPException(status_code=500, detail="Quiz was not created.")

    return quiz