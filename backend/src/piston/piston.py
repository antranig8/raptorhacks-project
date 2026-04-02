from pyston import PystonClient, File
from pyston.exceptions import TooManyRequests
from pydantic import BaseModel
from typing import Any
import requests
import os

PISTON_API_KEY = os.getenv("PISTON_API_KEY")


class PistonStage(BaseModel):
    stdout: str | None
    stdrr: str | None
    output: str | None
    code: int | None
    signal: Any

class PistonOutput(BaseModel):
    error: Any = None
    run_stage: PistonStage | None = None
    language: str
    compile_stage: PistonStage | None = None

mock_output = {
  "raw_json": {
    "language": "python",
    "version": "3.10.0",
    "run": {
      "signal": None,
      "stdout": "test\n",
      "stderr": "",
      "code": 0,
      "output": "test\n",
      "memory": 5652000,
      "message": None,
      "status": None,
      "cpu_time": 29,
      "wall_time": 48
    }
  },
  "langauge": "python",
  "version": "3.10.0",
  "run_stage": {
    "stdout": "test\n",
    "stdrr": None,
    "output": "test\n",
    "code": 0,
    "signal": None
  },
  "compile_stage": None
}

class PistonWrapper():
    client: PystonClient = None

    def __init__(self):
        pass

    async def initialize(self):
        self.client = PystonClient(api_key=PISTON_API_KEY)

    async def cleanup(self):
        await self.client.close_session()

    async def test_code(self, language: str, code: str) -> PistonOutput:
        if self.client == None:
            return PistonOutput(error="Client not initialized", language=language)
        try:
            output = await self.client.execute(language, [File(code)])
        except TooManyRequests as e:
            return PistonOutput(error="Rate limit", language=language)

        piston_lang = output.langauge

        piston_run_stage = output.run_stage
        run_stage = None
        if piston_run_stage is not None:
            piston_run_stage = output.run_stage.__dict__
            run_stage = PistonStage(**piston_run_stage)

        piston_compile_stage = output.compile_stage
        compile_stage = None
        if piston_compile_stage is not None:
            piston_compile_stage = output.compile_stage.__dict__
            compile_stage = PistonStage(**piston_compile_stage)

        return PistonOutput(error=None,language=piston_lang, run_stage=run_stage, compile_stage=compile_stage)