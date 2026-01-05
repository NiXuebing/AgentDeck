import { useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_TOOLS, TOOL_LABELS } from '../../constants/tools'
import { CommandPalette } from './CommandPalette'

const reorderList = (list, fromIndex, toIndex) => {
  const next = list.slice()
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next
}

const reorderObject = (obj, fromKey, toKey) => {
  const keys = Object.keys(obj)
  const fromIndex = keys.indexOf(fromKey)
  const toIndex = keys.indexOf(toKey)
  if (fromIndex < 0 || toIndex < 0) return obj
  const nextKeys = reorderList(keys, fromIndex, toIndex)
  return nextKeys.reduce((acc, key) => {
    acc[key] = obj[key]
    return acc
  }, {})
}

export function SkillsRack({
  tools,
  onChangeTools,
  subAgents,
  onChangeSubAgents,
  skills,
  onChangeSkills,
  commands,
  onChangeCommands,
}) {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [highlightTool, setHighlightTool] = useState(null)
  const prevToolsRef = useRef(tools)

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    const prevTools = prevToolsRef.current
    if (tools.length > prevTools.length) {
      const newTool = tools.find((tool) => !prevTools.includes(tool))
      if (newTool) {
        setHighlightTool(newTool)
        const timer = setTimeout(() => setHighlightTool(null), 800)
        return () => clearTimeout(timer)
      }
    }
    prevToolsRef.current = tools
    return undefined
  }, [tools])

  const availableTools = useMemo(() => {
    const current = new Set(tools)
    return DEFAULT_TOOLS.filter((tool) => !current.has(tool))
  }, [tools])

  const handleToolDrop = (event, index) => {
    event.preventDefault()
    const fromIndex = Number(event.dataTransfer.getData('text/plain'))
    if (Number.isNaN(fromIndex) || fromIndex === index) return
    onChangeTools(reorderList(tools, fromIndex, index))
  }

  const handleObjectDrop = (event, targetKey, obj, setter) => {
    event.preventDefault()
    const fromKey = event.dataTransfer.getData('text/plain')
    if (!fromKey || fromKey === targetKey) return
    setter(reorderObject(obj, fromKey, targetKey))
  }

  const renderChips = (items, onDrop, onDragStart) => (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.map((item, index) => (
        <button
          key={item}
          type="button"
          className={`rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-neutral-700 ${
            highlightTool === item ? 'tool-fly-in' : ''
          }`}
          draggable
          onDragStart={(event) => onDragStart(event, item, index)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => onDrop(event, item, index)}
        >
          {TOOL_LABELS[item] || item}
        </button>
      ))}
    </div>
  )

  const toolChips = renderChips(
    tools,
    (event, _item, index) => handleToolDrop(event, index),
    (event, _item, index) => event.dataTransfer.setData('text/plain', String(index))
  )

  const subAgentKeys = Object.keys(subAgents)
  const subAgentChips = renderChips(
    subAgentKeys,
    (event, item) => handleObjectDrop(event, item, subAgents, onChangeSubAgents),
    (event, item) => event.dataTransfer.setData('text/plain', item)
  )

  const skillKeys = Object.keys(skills)
  const skillChips = renderChips(
    skillKeys,
    (event, item) => handleObjectDrop(event, item, skills, onChangeSkills),
    (event, item) => event.dataTransfer.setData('text/plain', item)
  )

  const commandKeys = Object.keys(commands)
  const commandChips = renderChips(
    commandKeys,
    (event, item) => handleObjectDrop(event, item, commands, onChangeCommands),
    (event, item) => event.dataTransfer.setData('text/plain', item)
  )

  return (
    <div className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Skills Rack</h3>
          <p className="text-xs text-neutral-500">Tools, sub-agents, skills, commands.</p>
        </div>
        <button
          type="button"
          className="rounded-full border border-black/10 bg-white/80 px-3 py-1 text-xs font-semibold text-neutral-700"
          onClick={() => setPaletteOpen(true)}
        >
          Add
        </button>
      </div>

      <div className="mt-4">
        <div className="text-xs font-semibold text-neutral-600">Tools</div>
        {toolChips}
      </div>

      <div className="mt-4">
        <div className="text-xs font-semibold text-neutral-600">Sub-agents</div>
        {subAgentChips}
      </div>

      <div className="mt-4">
        <div className="text-xs font-semibold text-neutral-600">Skills</div>
        {skillChips}
      </div>

      <div className="mt-4">
        <div className="text-xs font-semibold text-neutral-600">Commands</div>
        {commandChips}
      </div>

      <CommandPalette
        open={paletteOpen}
        options={availableTools}
        onClose={() => setPaletteOpen(false)}
        onSelect={(tool) => onChangeTools([...tools, tool])}
      />
    </div>
  )
}
