import anyio
import json

import pytest
from claude_agent_sdk import AssistantMessage, TextBlock

from app.intent_router import IntentRouter


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_intent_router_parses_json_response(monkeypatch):
    async def fake_query(prompt, options):
        payload = json.dumps(
            {
                "suggested_tools": ["WebSearch"],
                "reason": "Needs live information",
            }
        )
        yield AssistantMessage(model="test", content=[TextBlock(text=payload)])

    monkeypatch.setattr("app.intent_router.query", fake_query)

    router = IntentRouter(api_key="test-key")
    result = await router.suggest_tools("Find latest updates", "I can help with that.")

    assert result["suggested_tools"] == ["WebSearch"]
