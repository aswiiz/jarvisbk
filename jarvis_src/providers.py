"""AI Provider Architecture for JARVIS.

Supports modular adapters for:
- llm7 (free anonymous / keyless or API key)
- pollinations (free anonymous OpenAI-compatible API)
- groq (Groq Cloud API)
- gemini (Google Gemini via OpenAI compatibility or REST)
- openai (Official OpenAI API)
- claude (Anthropic Claude API)

Features:
- Configurable provider fallback order (LLM_PROVIDER_ORDER)
- Streaming token generator for SSE
- Cooldown on transient errors, rate limits, and timeouts
- Secret redaction in logs
"""
import json
import logging
import os
import re
import time
from typing import Any, Dict, Generator, List, Optional, Tuple

import requests

log = logging.getLogger("jarvis.providers")

DEFAULT_PROVIDER_ORDER = "llm7,pollinations,groq,gemini,openai,claude"


def redact_secrets(text: str) -> str:
    """Mask potential API keys or tokens from log messages."""
    if not text:
        return ""
    return re.sub(r'(key|token|bearer|secret)[=:\s]+["\']?([a-zA-Z0-9_\-\.]{8,})["\']?', r'\1: [REDACTED]', text, flags=re.I)


class BaseProvider:
    """Base interface for all AI provider adapters."""

    def __init__(self, name: str, model: str, api_key: str = "", base_url: str = ""):
        self.name = name
        self.model = model
        self.api_key = api_key
        self.base_url = base_url
        self.timeout = int(os.getenv("PROVIDER_TIMEOUT_SECONDS", "45"))

    def validate_configuration(self) -> Tuple[bool, str]:
        """Check if provider has the required keys/configuration."""
        return True, "Ready"

    def get_status(self) -> Dict[str, Any]:
        valid, msg = self.validate_configuration()
        return {
            "name": self.name,
            "model": self.model,
            "configured": valid,
            "message": msg,
            "has_key": bool(self.api_key),
        }

    def generate_response(self, messages: List[Dict[str, str]], temperature: float = 0.3, max_tokens: int = 1500) -> str:
        """Synchronous response generation."""
        raise NotImplementedError

    def stream_response(self, messages: List[Dict[str, str]], temperature: float = 0.3, max_tokens: int = 1500) -> Generator[str, None, None]:
        """Yield response tokens as they arrive."""
        full = self.generate_response(messages, temperature, max_tokens)
        yield full


class OpenAICompatibleProvider(BaseProvider):
    """Adapter for standard OpenAI-compatible endpoints (Groq, Gemini OpenAI endpoint, OpenRouter, Mistral, OpenAI)."""

    def __init__(self, name: str, model: str, api_key: str, base_url: str, key_required: bool = True):
        super().__init__(name, model, api_key, base_url)
        self.key_required = key_required

    def validate_configuration(self) -> Tuple[bool, str]:
        if self.key_required and not self.api_key:
            return False, f"Missing API key for {self.name}"
        return True, "Configured"

    def _get_client(self):
        from openai import OpenAI
        return OpenAI(
            api_key=self.api_key or "not-needed",
            base_url=self.base_url,
            timeout=self.timeout,
            max_retries=0,
        )

    def generate_response(self, messages: List[Dict[str, str]], temperature: float = 0.3, max_tokens: int = 1500) -> str:
        client = self._get_client()
        response = client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        content = response.choices[0].message.content or ""
        # Strip reasoning tags if present
        clean = re.sub(r"<think>.*?</think>", "", content, flags=re.S).strip()
        return clean

    def stream_response(self, messages: List[Dict[str, str]], temperature: float = 0.3, max_tokens: int = 1500) -> Generator[str, None, None]:
        client = self._get_client()
        stream = client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
        )
        for chunk in stream:
            if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content


class LLM7Provider(OpenAICompatibleProvider):
    """LLM7 provider adapter. Works without a key or with optional LLM7_API_KEY."""

    def __init__(self):
        key = os.getenv("LLM7_API_KEY", "").strip()
        model = os.getenv("LLM_LLM7_MODEL", "gpt-oss:20b").strip()
        base = os.getenv("LLM7_BASE_URL", "https://api.llm7.io/v1").strip()
        super().__init__("llm7", model, key, base, key_required=False)


class PollinationsProvider(BaseProvider):
    """Pollinations.ai provider adapter. Free, anonymous, keyless AI provider."""

    def __init__(self):
        model = os.getenv("LLM_POLLINATIONS_MODEL", "openai").strip()
        super().__init__("pollinations", model, api_key="", base_url="https://text.pollinations.ai")

    def validate_configuration(self) -> Tuple[bool, str]:
        return True, "Keyless free provider ready"

    def generate_response(self, messages: List[Dict[str, str]], temperature: float = 0.3, max_tokens: int = 1500) -> str:
        url = f"{self.base_url}/openai"
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False,
        }
        res = requests.post(url, json=payload, timeout=self.timeout)
        res.raise_for_status()
        data = res.json()
        if "choices" in data and len(data["choices"]) > 0:
            return data["choices"][0]["message"]["content"]
        if "text" in data:
            return data["text"]
        return res.text

    def stream_response(self, messages: List[Dict[str, str]], temperature: float = 0.3, max_tokens: int = 1500) -> Generator[str, None, None]:
        url = f"{self.base_url}/openai"
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }
        with requests.post(url, json=payload, stream=True, timeout=self.timeout) as resp:
            resp.raise_for_status()
            for line in resp.iter_lines():
                if not line:
                    continue
                decoded = line.decode("utf-8").strip()
                if decoded.startswith("data: "):
                    raw_data = decoded[6:]
                    if raw_data == "[DONE]":
                        break
                    try:
                        chunk = json.loads(raw_data)
                        delta = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                        if delta:
                            yield delta
                    except Exception:
                        pass


class ClaudeProvider(BaseProvider):
    """Anthropic Claude API adapter."""

    def __init__(self):
        key = os.getenv("ANTHROPIC_API_KEY", "").strip()
        model = os.getenv("LLM_CLAUDE_MODEL", "claude-3-5-sonnet-latest").strip()
        super().__init__("claude", model, key, "https://api.anthropic.com/v1")

    def validate_configuration(self) -> Tuple[bool, str]:
        if not self.api_key:
            return False, "ANTHROPIC_API_KEY not configured"
        return True, "Configured"

    def _convert_messages(self, messages: List[Dict[str, str]]) -> Tuple[Optional[str], List[Dict[str, str]]]:
        system_prompt = None
        user_msgs = []
        for m in messages:
            if m["role"] == "system":
                system_prompt = m["content"]
            else:
                user_msgs.append({"role": m["role"], "content": m["content"]})
        return system_prompt, user_msgs

    def generate_response(self, messages: List[Dict[str, str]], temperature: float = 0.3, max_tokens: int = 1500) -> str:
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        system_prompt, user_msgs = self._convert_messages(messages)
        payload: Dict[str, Any] = {
            "model": self.model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": user_msgs,
        }
        if system_prompt:
            payload["system"] = system_prompt

        res = requests.post(f"{self.base_url}/messages", headers=headers, json=payload, timeout=self.timeout)
        res.raise_for_status()
        data = res.json()
        content_blocks = data.get("content", [])
        return "".join([b.get("text", "") for b in content_blocks if b.get("type") == "text"])

    def stream_response(self, messages: List[Dict[str, str]], temperature: float = 0.3, max_tokens: int = 1500) -> Generator[str, None, None]:
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        system_prompt, user_msgs = self._convert_messages(messages)
        payload: Dict[str, Any] = {
            "model": self.model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": user_msgs,
            "stream": True,
        }
        if system_prompt:
            payload["system"] = system_prompt

        with requests.post(f"{self.base_url}/messages", headers=headers, json=payload, stream=True, timeout=self.timeout) as resp:
            resp.raise_for_status()
            for line in resp.iter_lines():
                if not line:
                    continue
                decoded = line.decode("utf-8").strip()
                if decoded.startswith("data: "):
                    raw_data = decoded[6:]
                    try:
                        event = json.loads(raw_data)
                        if event.get("type") == "content_block_delta":
                            delta = event.get("delta", {}).get("text", "")
                            if delta:
                                yield delta
                    except Exception:
                        pass


class ProviderRouter:
    """Manages provider adapters, status checking, and automatic fallback."""

    def __init__(self):
        self._cooldown: Dict[str, float] = {}
        self.providers: Dict[str, BaseProvider] = self._init_providers()

    def _init_providers(self) -> Dict[str, BaseProvider]:
        providers: Dict[str, BaseProvider] = {}

        # LLM7
        providers["llm7"] = LLM7Provider()

        # Pollinations
        providers["pollinations"] = PollinationsProvider()

        # Groq
        groq_key = os.getenv("GROQ_API_KEY", "").strip()
        groq_model = os.getenv("LLM_GROQ_MODEL", "llama-3.3-70b-versatile").strip()
        providers["groq"] = OpenAICompatibleProvider(
            "groq", groq_model, groq_key, "https://api.groq.com/openai/v1", key_required=True
        )

        # Gemini (via OpenAI-compatible endpoint)
        gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
        gemini_model = os.getenv("LLM_GEMINI_MODEL", "gemini-2.5-flash").strip()
        providers["gemini"] = OpenAICompatibleProvider(
            "gemini", gemini_model, gemini_key, "https://generativelanguage.googleapis.com/v1beta/openai/", key_required=True
        )

        # OpenAI
        openai_key = os.getenv("OPENAI_API_KEY", "").strip()
        openai_model = os.getenv("LLM_OPENAI_MODEL", "gpt-4o-mini").strip()
        providers["openai"] = OpenAICompatibleProvider(
            "openai", openai_model, openai_key, "https://api.openai.com/v1", key_required=True
        )

        # Claude
        providers["claude"] = ClaudeProvider()

        # Custom provider if configured
        custom_base = os.getenv("CUSTOM_LLM_BASE_URL", "").strip()
        if custom_base:
            custom_key = os.getenv("CUSTOM_LLM_API_KEY", "").strip()
            custom_model = os.getenv("CUSTOM_LLM_MODEL", "default").strip()
            providers["custom"] = OpenAICompatibleProvider(
                "custom", custom_model, custom_key, custom_base, key_required=False
            )

        return providers

    def get_provider_order(self) -> List[str]:
        raw = os.getenv("LLM_PROVIDER_ORDER", DEFAULT_PROVIDER_ORDER)
        order = [x.strip().lower() for x in raw.split(",") if x.strip()]
        return [p for p in order if p in self.providers]

    def get_statuses(self) -> List[Dict[str, Any]]:
        order = self.get_provider_order()
        # Add remaining providers not in explicit order
        all_names = order + [name for name in self.providers if name not in order]
        return [self.providers[name].get_status() for name in all_names]

    def is_provider_available(self, name: str) -> bool:
        if name not in self.providers:
            return False
        valid, _ = self.providers[name].validate_configuration()
        return valid

    def generate_with_fallback(
        self,
        messages: List[Dict[str, str]],
        preferred_provider: str = "auto",
        temperature: float = 0.3,
        max_tokens: int = 1500,
    ) -> Tuple[str, str]:
        """Try requested provider, or loop through configured order with graceful fallback.
        Returns: (response_text, provider_name_used)
        """
        now = time.time()
        order = self.get_provider_order()

        if preferred_provider != "auto" and preferred_provider in self.providers:
            # Place preferred provider first
            candidates = [preferred_provider] + [p for p in order if p != preferred_provider]
        else:
            candidates = order

        last_error = None
        for p_name in candidates:
            provider = self.providers.get(p_name)
            if not provider:
                continue

            valid, reason = provider.validate_configuration()
            if not valid:
                continue

            # Check cooldown
            if self._cooldown.get(p_name, 0) > now:
                log.info("Provider %s is in cooldown, skipping", p_name)
                continue

            try:
                log.info("Generating response with provider: %s (%s)", p_name, provider.model)
                text = provider.generate_response(messages, temperature=temperature, max_tokens=max_tokens)
                if text and text.strip():
                    return text.strip(), p_name
            except Exception as exc:
                last_error = exc
                err_msg = redact_secrets(str(exc))
                log.warning("Provider %s failed: %s", p_name, err_msg)
                # Apply 30s cooldown for transient failures
                self._cooldown[p_name] = now + 30

        raise RuntimeError(f"All configured AI providers failed. Last error: {redact_secrets(str(last_error))}")

    def stream_with_fallback(
        self,
        messages: List[Dict[str, str]],
        preferred_provider: str = "auto",
        temperature: float = 0.3,
        max_tokens: int = 1500,
    ) -> Tuple[Generator[str, None, None], str]:
        """Stream response using preferred provider or fallback order."""
        now = time.time()
        order = self.get_provider_order()

        if preferred_provider != "auto" and preferred_provider in self.providers:
            candidates = [preferred_provider] + [p for p in order if p != preferred_provider]
        else:
            candidates = order

        for p_name in candidates:
            provider = self.providers.get(p_name)
            if not provider:
                continue
            valid, _ = provider.validate_configuration()
            if not valid or self._cooldown.get(p_name, 0) > now:
                continue

            try:
                gen = provider.stream_response(messages, temperature=temperature, max_tokens=max_tokens)
                return gen, p_name
            except Exception as exc:
                self._cooldown[p_name] = now + 30
                log.warning("Provider %s stream init failed: %s", p_name, redact_secrets(str(exc)))

        # Fallback to synchronous generation
        text, used_p = self.generate_with_fallback(messages, preferred_provider, temperature, max_tokens)

        def _fallback_gen():
            yield text

        return _fallback_gen(), used_p
