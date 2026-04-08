from pydantic import BaseModel
from typing import List, Optional, Union

# S2C

class Choice(BaseModel):
    id: str
    label: str
    isCorrect: bool
    reasoning: str

class QuizQuestion(BaseModel):
    type: str
    prompt: str
    isSkippable: bool
    choices: List[Choice] = []
    expectedStdout: Optional[str] = None
    language: Optional[str] = None # language for Piston
    codeTemplate: Optional[str] = None # The wrapper for Piston
    userGuidance: Optional[str] = None # What the user sees in the IDE

class Quiz(BaseModel):
    questions: List[QuizQuestion]

class QuizAnswerCodeResponse(BaseModel):
    error: Optional[str] = None

# C2S

class QuizCreateRequest(BaseModel):
    prompt: str

class QuizAnswer(BaseModel):
    quiz_id: str
    question_index: int
    # Union handles single string (choice ID/code) or list (Multiple/SelectAll)
    answer: Union[str, List[str]]

class QuizSubmission(BaseModel):
    quiz_id: str
    answers: List[QuizAnswer]

