import json
from typing import Any, Dict, Optional

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    TextBlock,
    query,
)


class BlueprintGenerator:
    _OUTPUT_SCHEMA: Dict[str, Any] = {
        "type": "object",
        "properties": {
            "config": {"type": "object"},
        },
        "required": ["config"],
        "additionalProperties": False,
    }

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key
        self.options = ClaudeAgentOptions(
            allowed_tools=[],
            permission_mode="plan",
            output_format={
                "type": "json_schema",
                "schema": self._OUTPUT_SCHEMA,
            },
            env={"ANTHROPIC_API_KEY": api_key} if api_key else {},
        )

    def _parse_json_text(self, text: str) -> Dict[str, Any]:
        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise ValueError("No JSON content in response") from exc

    async def _generate_with_env(self, prompt: str) -> Dict[str, Any]:
        system_prompt = (
            "You are an architect that outputs JSON only. "
            "Return {\"config\": {...}} with id, name, system_prompt, allowed_tools, "
            "optional skills/agents/commands. No markdown."
        )
        full_prompt = f"{system_prompt}\n\n{prompt}"

        chunks = []
        structured_output = None
        async for message in query(prompt=full_prompt, options=self.options):
            if isinstance(message, AssistantMessage):
                structured_output = getattr(message, "structured_output", None) or structured_output
                for block in message.content:
                    if isinstance(block, TextBlock):
                        chunks.append(block.text)

        if structured_output is not None:
            return structured_output

        return self._parse_json_text("".join(chunks))

    async def generate(self, prompt: str) -> Dict[str, Any]:
        return await self._generate_with_env(prompt)
