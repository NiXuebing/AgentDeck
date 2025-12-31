"""Generate .claude/ directory structure for agent configurations."""

import os
import json
from pathlib import Path
from typing import Dict, Any, List, Optional


def generate_agent_md(name: str, agent: Dict[str, Any]) -> str:
    """Generate markdown content for a sub-agent file."""
    lines = ["---"]
    lines.append(f"name: {name}")

    description = agent.get("description", "")
    if "\n" in description or len(description) > 60:
        lines.append("description: >-")
        for line in description.split("\n"):
            lines.append(f"  {line.strip()}")
    else:
        lines.append(f"description: {description}")

    tools = agent.get("allowed_tools") or agent.get("tools")
    if tools:
        lines.append("tools:")
        for tool in tools:
            lines.append(f"  - {tool}")

    model = agent.get("model")
    if model:
        lines.append(f"model: {model}")

    lines.append("---")
    lines.append("")
    lines.append(agent.get("prompt", ""))

    return "\n".join(lines)


def generate_skill_md(skill: Dict[str, Any]) -> str:
    """Generate SKILL.md content for a skill."""
    lines = ["---"]

    description = skill.get("description", "")
    if "\n" in description or len(description) > 60:
        lines.append("description: >-")
        for line in description.split("\n"):
            lines.append(f"  {line.strip()}")
    else:
        lines.append(f"description: {description}")

    lines.append("---")
    lines.append("")
    lines.append(skill.get("content", ""))

    return "\n".join(lines)


def generate_command_md(command: Dict[str, Any]) -> str:
    """Generate markdown content for a slash command."""
    lines = ["---"]

    if command.get("description"):
        lines.append(f"description: {command['description']}")

    if command.get("allowedTools"):
        lines.append(f"allowed-tools: {command['allowedTools']}")

    if command.get("argumentHint"):
        lines.append(f"argument-hint: {command['argumentHint']}")

    if command.get("model"):
        lines.append(f"model: {command['model']}")

    lines.append("---")
    lines.append("")
    lines.append(command.get("prompt", ""))

    return "\n".join(lines)


def generate_claude_directory(
    base_path: Path,
    config: Dict[str, Any],
    agents: Optional[Dict[str, Any]] = None,
    skills: Optional[Dict[str, Any]] = None,
    commands: Optional[Dict[str, Any]] = None,
) -> List[str]:
    """
    Generate .claude/ directory structure.

    Returns list of generated file paths (relative to base_path).
    """
    claude_dir = base_path / ".claude"
    generated_files = []

    # Create directories
    (claude_dir / "agents").mkdir(parents=True, exist_ok=True)
    (claude_dir / "skills").mkdir(parents=True, exist_ok=True)
    (claude_dir / "commands").mkdir(parents=True, exist_ok=True)

    # Write agent-config.json
    config_path = claude_dir / "agent-config.json"
    config_path.write_text(json.dumps(config, indent=2), encoding="utf-8")
    generated_files.append(".claude/agent-config.json")

    # Generate sub-agent files
    if agents:
        for name, agent in agents.items():
            agent_path = claude_dir / "agents" / f"{name}.md"
            agent_path.write_text(generate_agent_md(name, agent), encoding="utf-8")
            generated_files.append(f".claude/agents/{name}.md")

    # Generate skill directories and files
    if skills:
        for name, skill in skills.items():
            skill_dir = claude_dir / "skills" / name
            skill_dir.mkdir(parents=True, exist_ok=True)

            skill_md_path = skill_dir / "SKILL.md"
            skill_md_path.write_text(generate_skill_md(skill), encoding="utf-8")
            generated_files.append(f".claude/skills/{name}/SKILL.md")

            # Write resource files
            for resource in skill.get("resources", []):
                resource_path = skill_dir / resource["path"]
                resource_path.parent.mkdir(parents=True, exist_ok=True)
                resource_path.write_text(resource["content"], encoding="utf-8")
                generated_files.append(f".claude/skills/{name}/{resource['path']}")

    # Generate command files
    if commands:
        for name, command in commands.items():
            cmd_path = claude_dir / "commands" / f"{name}.md"
            cmd_path.write_text(generate_command_md(command), encoding="utf-8")
            generated_files.append(f".claude/commands/{name}.md")

    return generated_files
