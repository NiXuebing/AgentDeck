export const buildGenesisSteps = (config) => {
  if (!config) return []
  const steps = []

  if (config.system_prompt) {
    steps.push({ system_prompt: config.system_prompt })
  }

  if (config.allowed_tools) {
    steps.push({ allowed_tools: config.allowed_tools })
  }

  if (config.agents) {
    steps.push({ agents: config.agents })
  }

  if (config.skills) {
    steps.push({ skills: config.skills })
  }

  if (config.commands) {
    steps.push({ commands: config.commands })
  }

  return steps
}
