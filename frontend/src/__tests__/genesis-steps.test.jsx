import { buildGenesisSteps } from '../utils/genesisSteps'

it('builds staged config fragments for genesis fill', () => {
  const config = {
    system_prompt: 'Hello',
    allowed_tools: ['WebSearch'],
    agents: { helper: { description: 'x' } },
  }
  const steps = buildGenesisSteps(config)
  expect(steps[0].system_prompt).toBe('Hello')
  expect(steps.some((step) => step.allowed_tools)).toBe(true)
  expect(steps.some((step) => step.agents)).toBe(true)
})
