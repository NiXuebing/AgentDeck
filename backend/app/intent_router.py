import json
from typing import Any, Dict, List, Optional

from claude_agent_sdk import AssistantMessage, ClaudeAgentOptions, TextBlock, query


class IntentRouter:
    _OUTPUT_SCHEMA: Dict[str, Any] = {
        "type": "object",
        "properties": {
            "suggested_tools": {
                "type": "array",
                "items": {"type": "string"},
            },
            "reason": {"type": "string"},
        },
        "required": ["suggested_tools"],
        "additionalProperties": False,
    }

    def __init__(self, api_key: Optional[str] = None):
        self.options = ClaudeAgentOptions(
            allowed_tools=[],
            permission_mode="plan",
            output_format={
                "type": "json_schema",
                "schema": self._OUTPUT_SCHEMA,
            },
            env={"ANTHROPIC_API_KEY": api_key} if api_key else {},
        )

    async def suggest_tools(self, user_text: str, assistant_text: Optional[str]) -> Dict[str, List[str]]:
        prompt = (
            "You are a router. Return JSON only with "
            "{\"suggested_tools\": [..], \"reason\": \"...\"}. "
            "If no tool needed, return {\"suggested_tools\": []}. "
            f"User: {user_text} Assistant: {assistant_text or ''}"
        )

        chunks = []
        structured_output = None
        async for message in query(prompt=prompt, options=self.options):
            if isinstance(message, AssistantMessage):
                structured_output = getattr(message, "structured_output", None) or structured_output
                for block in message.content:
                    if isinstance(block, TextBlock):
                        chunks.append(block.text)

        if structured_output is not None:
            return structured_output

        return json.loads("".join(chunks))
