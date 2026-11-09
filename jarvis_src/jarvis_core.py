"""Enhanced JARVIS Core Pipeline.

Integrates:
1. Multi-provider AI routing with automatic fallback (LLM7, Pollinations, Groq, Gemini, Claude, OpenAI)
2. Hugging Face expert models pipeline for multi-modal requests
3. Structured Android device action parsing (alarms, timers, reminders, app launch)
4. Streaming token support for SSE
"""
from collections import Counter
import io
import json
import logging
import os
import re
import time
from typing import Any, Dict, Generator, List, Optional, Tuple

from actions import extract_device_actions
from prompts import PLANNER_SYSTEM, RESPONSE_SYSTEM
from providers import ProviderRouter, redact_secrets

log = logging.getLogger("jarvis.core")


class MissingConfig(RuntimeError):
    pass


TASK_REGISTRY = {
    "image-to-text": {
        "input": "image",
        "desc": "Describe or caption an image",
        "models": [
            "Salesforce/blip-image-captioning-large",
            "Salesforce/blip-image-captioning-base",
            "nlpconnect/vit-gpt2-image-captioning",
        ],
    },
    "object-detection": {
        "input": "image",
        "desc": "Detect and count objects in an image",
        "models": ["facebook/detr-resnet-50", "hustvl/yolos-small"],
    },
    "image-classification": {
        "input": "image",
        "desc": "Classify what an image shows",
        "models": ["google/vit-base-patch16-224"],
    },
    "text-to-image": {
        "input": "text",
        "desc": "Generate an image from a text prompt",
        "models": [
            "black-forest-labs/FLUX.1-schnell",
            "stabilityai/stable-diffusion-xl-base-1.0",
            "runwayml/stable-diffusion-v1-5",
        ],
    },
    "automatic-speech-recognition": {
        "input": "audio",
        "desc": "Transcribe speech from an audio file",
        "models": ["openai/whisper-large-v3", "openai/whisper-small"],
    },
    "token-classification": {
        "input": "text",
        "desc": "Named entity recognition (people, places, organizations)",
        "models": ["dslim/bert-base-NER"],
    },
    "text-classification": {
        "input": "text",
        "desc": "Sentiment analysis / text classification",
        "models": ["distilbert/distilbert-base-uncased-finetuned-sst-2-english"],
    },
    "summarization": {
        "input": "text",
        "desc": "Summarize a long text",
        "models": ["facebook/bart-large-cnn", "sshleifer/distilbart-cnn-12-6"],
    },
}


def _g(obj, key, default=None):
    if isinstance(obj, dict) and key in obj:
        return obj[key]
    return getattr(obj, key, default)


def _parse_json(raw: str) -> Dict[str, Any]:
    try:
        return json.loads(raw)
    except Exception:
        m = re.search(r"\{.*\}", raw or "", re.S)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                return {}
    return {}


class Jarvis:
    def __init__(self):
        self.router = ProviderRouter()
        self.hf_token = os.getenv("HUGGINGFACE_ACCESS_TOKEN", "").strip()
        self.max_tasks = int(os.getenv("MAX_TASKS", "6"))
        self._hf = None
        self.registry = {k: dict(v) for k, v in TASK_REGISTRY.items()}

        override = os.getenv("HF_MODELS_JSON", "").strip()
        if override:
            try:
                for task, models in json.loads(override).items():
                    if task in self.registry and isinstance(models, list) and models:
                        self.registry[task]["models"] = models
            except Exception as exc:
                log.warning("Ignoring invalid HF_MODELS_JSON: %s", exc)

    @property
    def hf(self):
        if not self.hf_token:
            return None
        if self._hf is None:
            try:
                from huggingface_hub import InferenceClient
                self._hf = InferenceClient(token=self.hf_token, timeout=120)
            except Exception as exc:
                log.warning("Failed to initialize Hugging Face client: %s", exc)
                return None
        return self._hf

    def status(self) -> Dict[str, Any]:
        return {
            "llm_providers": [p["name"] for p in self.router.get_statuses() if p.get("configured")],
            "all_provider_statuses": self.router.get_statuses(),
            "huggingface": bool(self.hf_token),
        }

    # ---------- stage 1: planning ----------
    def _plan(self, message: str, history: List[Dict[str, str]], files: List[Dict[str, Any]], provider: str = "auto") -> List[Dict[str, Any]]:
        # If no files and message doesn't suggest tool tasks, skip planning to reduce latency
        tool_keywords = ("image", "draw", "generate an image", "transcribe", "listen", "audio", "detect", "objects in", "classify")
        lower_msg = message.lower()
        if not files and not any(kw in lower_msg for kw in tool_keywords):
            return []

        task_list = "\n".join(
            f'- {name}: {spec["desc"]} (input type: {spec["input"]})'
            for name, spec in self.registry.items()
        )
        file_list = "\n".join(
            f'- file:{i} = {f["name"]} ({f["mime"]})' for i, f in enumerate(files)
        ) or "(none)"
        system = (
            PLANNER_SYSTEM.replace("__TASK_LIST__", task_list)
            .replace("__FILE_LIST__", file_list)
            .replace("__MAX__", str(self.max_tasks))
        )
        msgs = [{"role": "system", "content": system}] + history[-4:]
        msgs.append({"role": "user", "content": message})
        try:
            raw_plan, _ = self.router.generate_with_fallback(msgs, preferred_provider=provider, temperature=0.1)
            data = _parse_json(raw_plan)
        except Exception as exc:
            log.warning("Planning failed or skipped, answering directly: %s", redact_secrets(str(exc)))
            return []

        tasks = data.get("tasks", []) if isinstance(data, dict) else []
        clean = []
        for i, t in enumerate(tasks[: self.max_tasks]):
            if not isinstance(t, dict) or t.get("task") not in self.registry:
                continue
            try:
                tid = int(t.get("id", i))
            except (TypeError, ValueError):
                tid = i
            args = t.get("args") if isinstance(t.get("args"), dict) else {}
            clean.append({"id": tid, "task": t["task"], "args": args})
        return clean

    # ---------- stage 3: execution ----------
    def _resolve(self, ref: Any, kind: str, results: Dict, files: List[Dict]) -> Any:
        if isinstance(ref, str):
            s = ref.strip().strip("<>") if ref.strip().startswith("<file:") else ref.strip()
            m = re.fullmatch(r"<GENERATED>-(\d+)", s)
            if m:
                r = results.get(int(m.group(1)))
                if not r or r["status"] != "done":
                    raise ValueError(f"dependency {m.group(1)} did not finish")
                if kind in ("image", "audio"):
                    if r.get("bytes") is None:
                        raise ValueError(f"task {m.group(1)} produced no {kind}")
                    return r["bytes"]
                return r["text"]
            m = re.fullmatch(r"file:(\d+)", s)
            if m:
                idx = int(m.group(1))
                if idx >= len(files):
                    raise ValueError(f"file:{idx} was not uploaded")
                f = files[idx]
                if kind == "text":
                    if not f["mime"].startswith("text/"):
                        raise ValueError("text task needs a text file")
                    return f["data"].decode("utf-8", "replace")
                return f["data"]
        if kind == "text":
            return str(ref)
        raise ValueError(f"invalid {kind} reference: {ref!r}")

    def _call_hf(self, task: str, model: str, value: Any) -> Tuple[str, Optional[bytes], Optional[str]]:
        c = self.hf
        if not c:
            raise MissingConfig("Hugging Face API token is not configured on the server")

        if task == "image-to-text":
            out = c.image_to_text(value, model=model)
            return _g(out, "generated_text", str(out)), None, None
        if task == "object-detection":
            out = c.object_detection(value, model=model)
            counts = Counter(_g(o, "label") for o in out if _g(o, "score", 0) >= 0.5)
            if not counts:
                return "No objects detected with confidence >= 0.5", None, None
            parts = ", ".join(f"{k} x{v}" for k, v in counts.most_common())
            return f"Detected {sum(counts.values())} objects: {parts}", None, None
        if task == "image-classification":
            out = c.image_classification(value, model=model)
            top = ", ".join(f'{_g(o, "label")} ({_g(o, "score", 0):.2f})' for o in out[:3])
            return f"Top labels: {top}", None, None
        if task == "text-to-image":
            img = c.text_to_image(value, model=model)
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            return f"Generated an image from prompt: {value[:150]}", buf.getvalue(), "image/png"
        if task == "automatic-speech-recognition":
            out = c.automatic_speech_recognition(value, model=model)
            return _g(out, "text", str(out)), None, None
        if task == "token-classification":
            out = c.token_classification(value, model=model)
            ents = [f'{_g(o, "word")} ({_g(o, "entity_group") or _g(o, "entity")})' for o in out]
            return ("Entities: " + ", ".join(ents)) if ents else "No entities found", None, None
        if task == "text-classification":
            out = c.text_classification(value, model=model)
            top = ", ".join(f'{_g(o, "label")} ({_g(o, "score", 0):.2f})' for o in out[:3])
            return f"Classification: {top}", None, None
        if task == "summarization":
            out = c.summarization(value, model=model)
            return _g(out, "summary_text", str(out)), None, None
        raise ValueError(f"unsupported task {task}")

    def _execute(self, task: Dict, results: Dict, files: List, store: Any, base_url: str) -> Dict[str, Any]:
        spec = self.registry[task["task"]]
        kind = spec["input"]
        rec = {
            "id": task["id"], "task": task["task"], "model": None, "status": "failed",
            "text": "", "file_url": None, "mime": None, "error": None, "bytes": None,
        }
        try:
            ref = task["args"].get(kind)
            if ref is None and task["args"]:
                ref = next(iter(task["args"].values()))
            value = self._resolve(ref, kind, results, files)

            last_err = None
            for model in spec["models"]:
                try:
                    text, data, mime = self._call_hf(task["task"], model, value)
                    rec.update(model=model, status="done", text=text, bytes=data, mime=mime)
                    if data:
                        token = store.save_file(data, mime)
                        rec["file_url"] = f"{base_url}/files/{token}"
                    break
                except MissingConfig:
                    raise
                except Exception as exc:
                    last_err = exc
                    log.warning("%s via %s failed: %s", task["task"], model, exc)
            else:
                raise last_err or RuntimeError("no models configured")
        except Exception as exc:
            rec["error"] = str(exc)[:300]
        results[rec["id"]] = rec
        return rec

    def _prepare_prompt(self, message: str, history: List[Dict[str, str]], executed_tasks: List[Dict[str, Any]]) -> List[Dict[str, str]]:
        if executed_tasks:
            lines = []
            for r in executed_tasks:
                if r["status"] == "done":
                    extra = " (file attached)" if r["file_url"] else ""
                    lines.append(f'[{r["id"]}] {r["task"]} via {r["model"]}: {r["text"][:1500]}{extra}')
                else:
                    lines.append(f'[{r["id"]}] {r["task"]} FAILED: {r["error"]}')
            user_content = f"{message}\n\nExpert tool findings:\n" + "\n".join(lines)
        else:
            user_content = message

        msgs = [{"role": "system", "content": RESPONSE_SYSTEM}] + history[-8:]
        msgs.append({"role": "user", "content": user_content})
        return msgs

    # ---------- main execution entries ----------
    def run(self, message: str, history: List[Dict[str, str]], files: List[Dict[str, Any]], store: Any, base_url: str, provider: str = "auto") -> Dict[str, Any]:
        plan = self._plan(message, history, files, provider=provider)
        results, executed = {}, []
        for task in plan:
            executed.append(self._execute(task, results, files, store, base_url))

        msgs = self._prepare_prompt(message, history, executed)
        answer, used_provider = self.router.generate_with_fallback(msgs, preferred_provider=provider, temperature=0.35)

        # Detect actions
        actions = extract_device_actions(message, answer)

        public_tasks = [{k: v for k, v in r.items() if k != "bytes"} for r in executed]
        return {
            "response": answer,
            "provider": used_provider,
            "tasks": public_tasks,
            "actions": actions,
        }

    def stream_run(self, message: str, history: List[Dict[str, str]], files: List[Dict[str, Any]], store: Any, base_url: str, provider: str = "auto") -> Tuple[Generator[str, None, None], str, List[Dict[str, Any]], List[Dict[str, Any]]]:
        plan = self._plan(message, history, files, provider=provider)
        results, executed = {}, []
        for task in plan:
            executed.append(self._execute(task, results, files, store, base_url))

        msgs = self._prepare_prompt(message, history, executed)
        token_stream, used_provider = self.router.stream_with_fallback(msgs, preferred_provider=provider, temperature=0.35)
        actions = extract_device_actions(message, "")
        public_tasks = [{k: v for k, v in r.items() if k != "bytes"} for r in executed]

        return token_stream, used_provider, public_tasks, actions
