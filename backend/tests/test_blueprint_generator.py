import anyio
import json

import pytest
from claude_agent_sdk import AssistantMessage, TextBlock

from app.blueprint_generator import BlueprintGenerator


@pytest.fixture
def anyio_backend():
    return "asyncio"


def test_blueprint_generator_parses_json_text():
    generator = BlueprintGenerator()
    payload = json.dumps(
        {
            "config": {
                "id": "hn-digest",
                "name": "HN Digest",
                "system_prompt": "You are a tech editor",
                "allowed_tools": ["WebSearch", "WebFetch"],
            }
        }
    )
    result = generator._parse_json_text(payload)
    assert result["config"]["id"] == "hn-digest"
    assert "WebSearch" in result["config"]["allowed_tools"]


@pytest.mark.anyio
async def test_blueprint_generator_serializes_env_key_usage(monkeypatch):
    events = {
        "first_started": anyio.Event(),
        "second_started": anyio.Event(),
    }
    call_count = {"value": 0}

    async def fake_query(prompt, options):
        call_count["value"] += 1
        if call_count["value"] == 1:
            events["first_started"].set()
            with anyio.move_on_after(0.2):
                await events["second_started"].wait()
        else:
            events["second_started"].set()
            await events["first_started"].wait()
        env = getattr(options, "env", {}) or {}
        payload = json.dumps({"config": {"id": env.get("ANTHROPIC_API_KEY", "")}})
        yield AssistantMessage(model="test", content=[TextBlock(text=payload)])

    monkeypatch.setattr("app.blueprint_generator.query", fake_query)

    generator_one = BlueprintGenerator(api_key="key-one")
    generator_two = BlueprintGenerator(api_key="key-two")

    results = {}

    async def run(generator, prompt, key):
        results[key] = await generator.generate(prompt)

    async with anyio.create_task_group() as tg:
        tg.start_soon(run, generator_one, "first", "one")
        tg.start_soon(run, generator_two, "second", "two")

    assert results["one"]["config"]["id"] == "key-one"
    assert results["two"]["config"]["id"] == "key-two"
