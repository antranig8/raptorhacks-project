from __future__ import annotations

import ast
import math
import re
from dataclasses import dataclass
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from ..auth.throttling import rate_limit_chat
from ..dependencies.ai import get_ai_platform
from ..schemas.visual_python import (
    CanvasObject,
    CanvasRenderRequest,
    CanvasRenderResponse,
    CanvasStep,
    ProjectileFrame,
    ProjectileSimulationRequest,
    ProjectileSimulationResponse,
    ProjectileStep,
    VisualPythonExplainRequest,
    VisualPythonExplainResponse,
)


router = APIRouter()
VISUAL_EXPLANATION_MAX_TOKENS = 160

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


@dataclass(frozen=True)
class CompiledAssignment:
    target: str
    expression: ast.AST
    line: int
    code: str
    description: str


ACTION_DESCRIPTIONS = {
    "x": "Move horizontally",
    "y": "Move vertically",
    "vx": "Update horizontal velocity",
    "vy": "Update vertical velocity",
    "t": "Advance time",
    "dt": "Change time step",
    "gravity": "Change gravity",
    "speed": "Change launch speed",
    "angle": "Change launch angle",
}

CANVAS_COMMAND_ARITY = {
    "point": 2,
    "line": 4,
    "circle": 3,
    "rect": 4,
}

CANVAS_MAX_VARIABLES = 80
CANVAS_MAX_ABS_VALUE = 1_000_000


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


def _describe_assignment(target: str) -> str:
    return ACTION_DESCRIPTIONS.get(target, f"Update {target}")


def _compile_update_code(update_code: str) -> list[CompiledAssignment]:
    try:
        tree = ast.parse(update_code, mode="exec")
    except SyntaxError as exc:
        raise ValueError(f"Python syntax error on line {exc.lineno}.") from exc

    assignments: list[CompiledAssignment] = []
    for statement in tree.body:
        if not isinstance(statement, ast.Assign) or len(statement.targets) != 1:
            raise ValueError("Only assignment lines like y = y + vy * dt are allowed.")

        target = statement.targets[0]
        if not isinstance(target, ast.Name) or target.id not in ALLOWED_VARIABLES:
            raise ValueError("Assignments can only update x, y, vx, vy, t, dt, gravity, speed, or angle.")

        source_code = ast.get_source_segment(update_code, statement) or f"{target.id} = ..."
        assignments.append(
            CompiledAssignment(
                target=target.id,
                expression=statement.value,
                line=statement.lineno,
                code=source_code.strip(),
                description=_describe_assignment(target.id),
            )
        )

    return assignments


def _round_frame_value(value: float) -> float:
    return round(value, 4)


def _validate_canvas_value(value: float) -> float:
    if not math.isfinite(value) or abs(value) > CANVAS_MAX_ABS_VALUE:
        raise ValueError("Canvas values must stay between -1,000,000 and 1,000,000.")
    return value


def _validate_canvas_variable_name(name: str) -> None:
    if name in CANVAS_COMMAND_ARITY or name in ALLOWED_FUNCTIONS:
        raise ValueError(f'Variable "{name}" uses a reserved name.')
    if name.startswith("_"):
        raise ValueError("Variable names cannot start with an underscore.")


def _describe_canvas_assignment(target: str, before: float | None, after: float) -> str:
    rounded_after = _round_frame_value(after)
    if before is None:
        return f"Create variable {target} with value {rounded_after}"
    return f"Update variable {target} to {rounded_after}"


def _describe_canvas_command(command: str, args: list[float]) -> str:
    if command == "point":
        return f"Plot a point at ({_round_frame_value(args[0])}, {_round_frame_value(args[1])})"
    if command == "line":
        return (
            f"Draw a line from ({_round_frame_value(args[0])}, {_round_frame_value(args[1])}) "
            f"to ({_round_frame_value(args[2])}, {_round_frame_value(args[3])})"
        )
    if command == "circle":
        return (
            f"Draw a circle centered at ({_round_frame_value(args[0])}, {_round_frame_value(args[1])}) "
            f"with radius {_round_frame_value(args[2])}"
        )
    if command == "rect":
        return (
            f"Draw a rectangle at ({_round_frame_value(args[0])}, {_round_frame_value(args[1])}) "
            f"with width {_round_frame_value(args[2])} and height {_round_frame_value(args[3])}"
        )
    return f"Run {command}"


def _build_canvas_object(command: str, args: list[float]) -> CanvasObject:
    rounded_args = [_round_frame_value(arg) for arg in args]
    if command == "point":
        return CanvasObject(type="point", x=rounded_args[0], y=rounded_args[1])
    if command == "line":
        return CanvasObject(
            type="line",
            x1=rounded_args[0],
            y1=rounded_args[1],
            x2=rounded_args[2],
            y2=rounded_args[3],
        )
    if command == "circle":
        return CanvasObject(type="circle", x=rounded_args[0], y=rounded_args[1], radius=rounded_args[2])
    if command == "rect":
        return CanvasObject(
            type="rect",
            x=rounded_args[0],
            y=rounded_args[1],
            width=rounded_args[2],
            height=rounded_args[3],
        )
    raise ValueError(f'Command "{command}" is not available in this lab.')


def _render_canvas_code(request: CanvasRenderRequest) -> tuple[list[CanvasObject], list[CanvasStep], dict[str, float]]:
    try:
        tree = ast.parse(request.code, mode="exec")
    except SyntaxError as exc:
        raise ValueError(f"Python syntax error on line {exc.lineno}.") from exc

    objects: list[CanvasObject] = []
    steps: list[CanvasStep] = []
    variables: dict[str, float] = {}
    for statement in tree.body:
        source_code = ast.get_source_segment(request.code, statement) or ""

        if isinstance(statement, ast.Assign):
            if len(statement.targets) != 1 or not isinstance(statement.targets[0], ast.Name):
                raise ValueError("Canvas assignments must look like x = 5.")

            target = statement.targets[0].id
            _validate_canvas_variable_name(target)
            if target not in variables and len(variables) >= CANVAS_MAX_VARIABLES:
                raise ValueError("Python Canvas supports up to 80 variables.")

            before_value = variables.get(target)
            after_value = _validate_canvas_value(_evaluate_expression(statement.value, variables))
            variables[target] = after_value
            steps.append(
                CanvasStep(
                    line=statement.lineno,
                    code=source_code.strip() or f"{target} = ...",
                    command="assign",
                    target=target,
                    before=None if before_value is None else _round_frame_value(before_value),
                    after=_round_frame_value(after_value),
                    description=_describe_canvas_assignment(target, before_value, after_value),
                )
            )
            continue

        if not isinstance(statement, ast.Expr) or not isinstance(statement.value, ast.Call):
            raise ValueError("Only variable assignments and drawing calls like point(5, 3) are allowed in Python Canvas.")

        call = statement.value
        if not isinstance(call.func, ast.Name) or call.func.id not in CANVAS_COMMAND_ARITY:
            raise ValueError('Only point(), line(), circle(), and rect() are available in Python Canvas.')
        if call.keywords:
            raise ValueError("Keyword arguments are not allowed in Python Canvas.")

        command = call.func.id
        expected_arg_count = CANVAS_COMMAND_ARITY[command]
        if len(call.args) != expected_arg_count:
            raise ValueError(f"{command}() expects {expected_arg_count} numeric arguments.")

        args = [_validate_canvas_value(_evaluate_expression(arg, variables)) for arg in call.args]
        objects.append(_build_canvas_object(command, args))
        steps.append(
            CanvasStep(
                line=statement.lineno,
                code=source_code.strip(),
                command=command,
                description=_describe_canvas_command(command, args),
            )
        )

    rounded_variables = {name: _round_frame_value(value) for name, value in variables.items()}
    return objects, steps, rounded_variables


def _run_projectile_simulation(request: ProjectileSimulationRequest) -> list[ProjectileFrame]:
    setup = request.setup
    assignments = _compile_update_code(request.update_code)
    updates_time = any(assignment.target == "t" for assignment in assignments)
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
        frame_steps: list[ProjectileStep] = []
        for assignment in assignments:
            before_value = variables[assignment.target]
            variables[assignment.target] = _evaluate_expression(assignment.expression, variables)
            frame_steps.append(
                ProjectileStep(
                    line=assignment.line,
                    code=assignment.code,
                    target=assignment.target,
                    before=_round_frame_value(before_value),
                    after=_round_frame_value(variables[assignment.target]),
                    description=assignment.description,
                )
            )

        if not updates_time:
            variables["t"] += setup.dt

        frames.append(
            ProjectileFrame(
                t=_round_frame_value(variables["t"]),
                x=_round_frame_value(variables["x"]),
                y=_round_frame_value(variables["y"]),
                vx=_round_frame_value(variables["vx"]),
                vy=_round_frame_value(variables["vy"]),
                steps=frame_steps,
            )
        )

        if step > 3 and variables["y"] < 0:
            break

    return frames


@router.post("/canvas", response_model=CanvasRenderResponse, status_code=status.HTTP_200_OK)
async def render_canvas(request: CanvasRenderRequest):
    try:
        objects, steps, variables = _render_canvas_code(request)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except OverflowError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="The canvas values grew too large.") from exc

    return CanvasRenderResponse(
        objects=objects,
        steps=steps,
        variables=variables,
        message=f"Canvas rendered {len(objects)} objects.",
    )


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
                "You explain short Python visual programming code to beginner students. "
                "Keep the answer under 90 words. Explain what each assignment or drawing call changes visually. "
                "Use plain English only. Do not include chain-of-thought, code blocks, corrected code, or replacement lines."
            ),
        },
        {
            "role": "user",
            "content": f"Lab: {request.lab}\nPython update code:\n{request.update_code}",
        },
    ]

    try:
        response_text, _usage = ai_platform.chat_messages(
            messages,
            temperature=0.2,
            max_tokens=VISUAL_EXPLANATION_MAX_TOKENS,
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI provider request failed.") from exc

    return VisualPythonExplainResponse(explanation=_clean_ai_explanation(response_text))
