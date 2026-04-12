from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any
from urllib import error, request

from pydantic import BaseModel, ValidationError


@dataclass
class LLMStructuredResult:
    mode: str
    payload: BaseModel | None
    warnings: list[str]


def _build_headers(api_key: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }


def _extract_response_text(payload: dict[str, Any]) -> str | None:
    if isinstance(payload.get("output_text"), str):
        return payload["output_text"]

    output = payload.get("output")
    if isinstance(output, list):
        for item in output:
            content = item.get("content") if isinstance(item, dict) else None
            if isinstance(content, list):
                for chunk in content:
                    if isinstance(chunk, dict) and isinstance(chunk.get("text"), str):
                        return chunk["text"]

    choices = payload.get("choices")
    if isinstance(choices, list) and choices:
        message = choices[0].get("message") if isinstance(choices[0], dict) else None
        if isinstance(message, dict) and isinstance(message.get("content"), str):
            return message["content"]

    return None


def _post_json(url: str, headers: dict[str, str], body: dict[str, Any]) -> dict[str, Any]:
    raw = json.dumps(body).encode("utf-8")
    req = request.Request(url, data=raw, headers=headers, method="POST")
    with request.urlopen(req, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def _call_responses(base_url: str, api_key: str, model: str, schema_name: str, schema: dict[str, Any], system_prompt: str, user_prompt: str) -> dict[str, Any]:
    return _post_json(
        f"{base_url}/responses",
        _build_headers(api_key),
        {
            "model": model,
            "input": [
                {
                    "role": "system",
                    "content": [{"type": "input_text", "text": system_prompt}],
                },
                {
                    "role": "user",
                    "content": [{"type": "input_text", "text": user_prompt}],
                },
            ],
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": schema_name,
                    "schema": schema,
                    "strict": True,
                }
            },
        },
    )


def _call_chat_completions(base_url: str, api_key: str, model: str, schema_name: str, schema: dict[str, Any], system_prompt: str, user_prompt: str) -> dict[str, Any]:
    return _post_json(
        f"{base_url}/chat/completions",
        _build_headers(api_key),
        {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": schema_name,
                    "schema": schema,
                    "strict": True,
                },
            },
        },
    )


def request_structured_output(schema_name: str, schema_model: type[BaseModel], system_prompt: str, user_prompt: str) -> LLMStructuredResult:
    base_url = os.getenv("OPENAI_BASE_URL")
    api_key = os.getenv("OPENAI_API_KEY")
    model = os.getenv("OPENAI_MODEL")

    if not base_url or not api_key or not model:
        return LLMStructuredResult(mode="fallback", payload=None, warnings=["LLM config missing; using deterministic fallback."])

    base_url = base_url.rstrip("/")
    schema = schema_model.model_json_schema()
    warnings: list[str] = []

    try:
        payload = _call_responses(base_url, api_key, model, schema_name, schema, system_prompt, user_prompt)
        text = _extract_response_text(payload)
        if not text:
            raise ValueError("No structured text returned from Responses API.")
        return LLMStructuredResult(mode="live", payload=schema_model.model_validate(json.loads(text)), warnings=warnings)
    except (error.HTTPError, error.URLError, ValidationError, ValueError, json.JSONDecodeError) as exc:
        warnings.append(f"Responses API unavailable: {exc}")

    try:
        payload = _call_chat_completions(base_url, api_key, model, schema_name, schema, system_prompt, user_prompt)
        text = _extract_response_text(payload)
        if not text:
            raise ValueError("No structured text returned from Chat Completions API.")
        return LLMStructuredResult(mode="live", payload=schema_model.model_validate(json.loads(text)), warnings=warnings)
    except (error.HTTPError, error.URLError, ValidationError, ValueError, json.JSONDecodeError) as exc:
        warnings.append(f"Chat Completions API unavailable: {exc}")
        return LLMStructuredResult(mode="fallback", payload=None, warnings=warnings)
