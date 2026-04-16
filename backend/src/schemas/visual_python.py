from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class ProjectileSetup(BaseModel):
    gravity: float = Field(default=9.8, ge=-100.0, le=100.0)
    speed: float = Field(default=20.0, ge=0.0, le=300.0)
    angle: float = Field(default=45.0, ge=-90.0, le=90.0)
    dt: float = Field(default=0.05, ge=0.005, le=1.0)
    max_steps: int = Field(default=240, ge=10, le=600)


class ProjectileSimulationRequest(BaseModel):
    setup: ProjectileSetup = Field(default_factory=ProjectileSetup)
    update_code: str = Field(min_length=1, max_length=1200)

    @field_validator("update_code")
    @classmethod
    def _strip_update_code(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Update code cannot be blank.")
        return value


class ProjectileStep(BaseModel):
    line: int
    code: str
    target: str
    before: float
    after: float
    description: str


class ProjectileFrame(BaseModel):
    t: float
    x: float
    y: float
    vx: float
    vy: float
    steps: list[ProjectileStep] = Field(default_factory=list)


class ProjectileSimulationResponse(BaseModel):
    frames: list[ProjectileFrame]
    message: str


class CanvasRenderRequest(BaseModel):
    code: str = Field(min_length=1, max_length=1200)

    @field_validator("code")
    @classmethod
    def _strip_code(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Canvas code cannot be blank.")
        return value


class CanvasObject(BaseModel):
    type: str
    x: float | None = None
    y: float | None = None
    x1: float | None = None
    y1: float | None = None
    x2: float | None = None
    y2: float | None = None
    width: float | None = None
    height: float | None = None
    radius: float | None = None


class CanvasStep(BaseModel):
    line: int
    code: str
    command: str
    description: str
    target: str | None = None
    before: float | None = None
    after: float | None = None


class CanvasRenderResponse(BaseModel):
    objects: list[CanvasObject]
    steps: list[CanvasStep]
    variables: dict[str, float] = Field(default_factory=dict)
    message: str


class VisualPythonExplainRequest(BaseModel):
    lab: str = Field(default="projectile", max_length=80)
    update_code: str = Field(min_length=1, max_length=1200)

    @field_validator("lab", "update_code")
    @classmethod
    def _strip_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be blank.")
        return value


class VisualPythonExplainResponse(BaseModel):
    explanation: str
