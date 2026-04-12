from __future__ import annotations

import ast
import math
import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from ..auth.throttling import rate_limit_chat
from ..dependencies.ai import get_ai_platform
from ..schemas.visual_python import (
    ProjectileFrame,
    ProjectileSimulationRequest,
    ProjectileSimulationResponse,
    VisualPythonExplainRequest,
    VisualPythonExplainResponse,
)


router = APIRouter()

ALLOWED_VARIABLES = {
    "x",
    "y",
    "vx",
    "vy",
    "t",
    "dt",
    "gravity",
    "speed",
    "angle",
}

ALLOWED_FUNCTIONS = {
    "abs": abs,
    "min": min,
    "max": max,
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
    "sqrt": math.sqrt,
    "radians": math.radians,
}


def _clean_ai_explanation(raw_text: str) -> str:
    cleaned = raw_text or ""
    cleaned = re.sub(r"<think>.*?</think>", "", cleaned, flags=re.DOTALL | re.IGNORECASE)
    cleaned = re.sub(r"<think>.*?(?:\n\s*\n|$)", "", cleaned, flags=re.DOTALL | re.IGNORECASE)
    cleaned = re.sub(r"```.*?```", "", cleaned, flags=re.DOTALL).strip()
    cleaned = "\n".join(
        line for line in cleaned.splitlines()
        if not re.match(r"^\s*[a-zA-Z_][a-zA-Z0-9_]*\s*=", line)
    ).strip()
    return cleaned or "No explanation returned."


def _evaluate_expression(node: ast.AST, variables: dict[str, float]) -> float:
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return float(node.value)

    if isinstance(node, ast.Name):
        if node.id not in variables:
            raise ValueError(f'Variable "{node.id}" is not available in this lab.')
        return variables[node.id]

    if isinstance(node, ast.UnaryOp):
        value = _evaluate_expression(node.operand, variables)
        if isinstance(node.op, ast.USub):
            return -value
        if isinstance(node.op, ast.UAdd):
            return value
        raise ValueError("Only + and - unary operators are allowed.")

    if isinstance(node, ast.BinOp):
        left = _evaluate_expression(node.left, variables)
        right = _evaluate_expression(node.right, variables)
        if isinstance(node.op, ast.Add):
            return left + right
        if isinstance(node.op, ast.Sub):
            return left - right
        if isinstance(node.op, ast.Mult):
            return left * right
        if isinstance(node.op, ast.Div):
            if right == 0:
                raise ValueError("Division by zero is not allowed.")
            return left / right
        if isinstance(node.op, ast.Pow):
            return left ** right
        raise ValueError("Only +, -, *, /, and ** are allowed.")

    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
        if node.func.id not in ALLOWED_FUNCTIONS:
            raise ValueError(f'Function "{node.func.id}" is not available in this lab.')
        if node.keywords:
            raise ValueError("Keyword arguments are not allowed.")
        args = [_evaluate_expression(arg, variables) for arg in node.args]
        return float(ALLOWED_FUNCTIONS[node.func.id](*args))

    raise ValueError("Only simple math expressions are allowed.")


def _compile_update_code(update_code: str) -> list[tuple[str, ast.AST]]:
    try:
        tree = ast.parse(update_code, mode="exec")
    except SyntaxError as exc:
        raise ValueError(f"Python syntax error on line {exc.lineno}.") from exc

    assignments: list[tuple[str, ast.AST]] = []
    for statement in tree.body:
        if not isinstance(statement, ast.Assign) or len(statement.targets) != 1:
            raise ValueError("Only assignment lines like y = y + vy * dt are allowed.")

        target = statement.targets[0]
        if not isinstance(target, ast.Name) or target.id not in ALLOWED_VARIABLES:
            raise ValueError("Assignments can only update x, y, vx, vy, t, dt, gravity, speed, or angle.")

        assignments.append((target.id, statement.value))

    return assignments


def _round_frame_value(value: float) -> float:
    return round(value, 4)


def _run_projectile_simulation(request: ProjectileSimulationRequest) -> list[ProjectileFrame]:
    setup = request.setup
    assignments = _compile_update_code(request.update_code)
    updates_time = any(target == "t" for target, _expression in assignments)
    angle_radians = math.radians(setup.angle)
    variables: dict[str, float] = {
        "x": 0.0,
        "y": 0.0,
        "vx": setup.speed * math.cos(angle_radians),
        "vy": setup.speed * math.sin(angle_radians),
        "t": 0.0,
        "dt": setup.dt,
        "gravity": setup.gravity,
        "speed": setup.speed,
        "angle": setup.angle,
    }

    frames = [
        ProjectileFrame(
            t=_round_frame_value(variables["t"]),
            x=_round_frame_value(variables["x"]),
            y=_round_frame_value(variables["y"]),
            vx=_round_frame_value(variables["vx"]),
            vy=_round_frame_value(variables["vy"]),
        )
    ]

    for step in range(setup.max_steps):
        for target, expression in assignments:
            variables[target] = _evaluate_expression(expression, variables)

        if not updates_time:
            variables["t"] += setup.dt

        frames.append(
            ProjectileFrame(
                t=_round_frame_value(variables["t"]),
                x=_round_frame_value(variables["x"]),
                y=_round_frame_value(variables["y"]),
                vx=_round_frame_value(variables["vx"]),
                vy=_round_frame_value(variables["vy"]),
            )
        )

        if step > 3 and variables["y"] < 0:
            break

    return frames


@router.post("/projectile", response_model=ProjectileSimulationResponse, status_code=status.HTTP_200_OK)
async def simulate_projectile(request: ProjectileSimulationRequest):
    try:
        frames = _run_projectile_simulation(request)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except OverflowError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="The simulation values grew too large.") from exc

    return ProjectileSimulationResponse(
        frames=frames,
        message=f"Simulation ran for {len(frames)} frames.",
    )


@router.post(
    "/explain",
    response_model=VisualPythonExplainResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(rate_limit_chat)],
)
async def explain_visual_python_code(request: VisualPythonExplainRequest):
    ai_platform = get_ai_platform()
    messages: list[dict[str, Any]] = [
        {
            "role": "system",
            "content": (
                "You explain short Python physics update code to beginner physics students. "
                "Keep the answer under 90 words. Explain what each assignment changes in the simulation. "
                "Use plain English only. Do not include chain-of-thought, code blocks, corrected code, or replacement lines."
            ),
        },
        {
            "role": "user",
            "content": f"Lab: {request.lab}\nPython update code:\n{request.update_code}",
        },
    ]

    try:
        response_text, _usage = ai_platform.chat_messages(messages, temperature=0.2, max_tokens=220)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI provider request failed.") from exc

    return VisualPythonExplainResponse(explanation=_clean_ai_explanation(response_text))
