from pyston import PystonClient, File
from pyston.exceptions import TooManyRequests
from pydantic import BaseModel
from typing import Any, Optional
import asyncio
import os

PISTON_API_KEY = os.getenv("PISTON_API_KEY")


class PistonStage(BaseModel):
    stdout: Optional[str]
    stderr: Optional[str]
    output: Optional[str]
    code: Optional[int]
    signal: Any

class PistonOutput(BaseModel):
    error: Any = None
    run_stage: Optional[PistonStage]
    language: str
    compile_stage: Optional[PistonStage]

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
    "stderr": None,
    "output": "test\n",
    "code": 0,
    "signal": None
  },
  "compile_stage": None
}

class PistonWrapper():
    client: PystonClient = None

    def __init__(self, rate_limit_delay=0.2):
        self.client = None
        self.queue = asyncio.Queue()
        self.rate_limit_delay = rate_limit_delay
        self._workers = []
        pass

    async def _worker_loop(self):
        while True:
            # Background worker used to serialize queued executions if this
            # wrapper is expanded to use the queue-driven path.
            language, code, future = await self.queue.get()
            
            try:
                result = await self._execute_request(language, code)
                future.set_result(result)
            except Exception as e:
                future.set_exception(e)
            finally:
                self.queue.task_done()
                await asyncio.sleep(self.rate_limit_delay)
    
    async def _execute_request(self, language: str, code: str) -> PistonOutput:
        if self.client == None:
            return PistonOutput(error="Client not initialized", language=language)
        try:
            output = await self.client.execute(language, [File(code)])
        except TooManyRequests as e:
            return PistonOutput(error="Rate limit", language=language)

        # Mirror the Pyston response into the app's stable schema so the quiz
        # router can handle compile/run output consistently.
        piston_lang = output.language

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

    async def initialize(self):
        self.client = PystonClient(api_key=PISTON_API_KEY)
        worker = asyncio.create_task(self._worker_loop())
        self._workers.append(worker)

    async def cleanup(self):
        for worker in self._workers:
            worker.cancel()
        
        if self._workers:
            await asyncio.gather(*self._workers, return_exceptions=True)
            
        await self.client.close_session()

    async def test_code(self, language: str, code: str) -> PistonOutput:
        # Direct execution path currently used by quiz answer validation.
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
    
piston = PistonWrapper()
