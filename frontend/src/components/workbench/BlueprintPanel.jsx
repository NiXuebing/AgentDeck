import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ProfileTab } from '../tabs/ProfileTab'
import { ToolboxTab } from '../tabs/ToolboxTab'
import { SkillsTab } from '../tabs/SkillsTab'
import { CommandsTab } from '../tabs/CommandsTab'
import { SubAgentCard } from '../SubAgentCard'

export function BlueprintPanel({
  form,
  onChangeForm,
  showSkeleton,
  activeTab,
  onChangeTab,
  subAgents,
  skills,
  commands,
  onAddSubAgent,
  onEditSubAgent,
  onDeleteSubAgent,
  onChangeSkills,
  onChangeCommands,
  onApply,
  hasDraftChanges,
  mcpServersJson,
  onMcpServersChange,
  isReloading,
  reloadError,
  canRollback,
  onRollback,
}) {
  const promptRef = useRef(null)

  useEffect(() => {
    if (!promptRef.current) return
    promptRef.current.style.height = 'auto'
    promptRef.current.style.height = `${promptRef.current.scrollHeight}px`
  }, [form.systemPrompt])

  if (showSkeleton) {
    return (
      <div
        className="rounded-2xl border border-dashed border-black/10 bg-white/60 px-6 py-8 text-sm text-neutral-500"
        data-testid="blueprint-skeleton"
      >
        Blueprint loading...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="section-title">Blueprint</h2>
          <p className="text-xs text-neutral-500">Drafting the agent configuration.</p>
        </div>
        <div className="flex items-center gap-2">
          {reloadError && canRollback ? (
            <button
              className="rounded-full border border-black/10 bg-white/80 px-3 py-1 text-xs font-semibold text-rose-600"
              onClick={onRollback}
              type="button"
            >
              Rollback
            </button>
          ) : null}
          <button
            className="btn-primary"
            onClick={() => onApply?.()}
            type="button"
            disabled={isReloading}
          >
            Apply
          </button>
        </div>
      </header>
      {reloadError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-xs text-rose-700">
          Reload failed: {reloadError}
        </div>
      ) : null}

      <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500" htmlFor="systemPrompt">
            System Prompt
          </label>
          {hasDraftChanges ? (
            <span
              className="h-2 w-2 rounded-full bg-amber-500"
              data-testid="unsaved-dot"
              title="Unsaved"
            />
          ) : null}
        </div>
        <div className="relative">
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl border border-black/5 bg-white/40 px-4 py-2.5 text-xs text-neutral-400">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {form.systemPrompt || ' '}
            </ReactMarkdown>
          </div>
          <textarea
            id="systemPrompt"
            ref={promptRef}
            className="relative z-10 min-h-[160px] w-full resize-none rounded-xl border border-black/10 bg-transparent px-4 py-2.5 text-xs text-neutral-900 shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            placeholder="You are a senior tech editor..."
            value={form.systemPrompt}
            onChange={(event) =>
              onChangeForm({ ...form, systemPrompt: event.target.value, useCustomPrompt: true })
            }
          />
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3">
        <div className="flex border-b border-black/10">
          {[
            { id: 'profile', label: 'Profile' },
            { id: 'toolbox', label: 'Toolbox' },
            { id: 'agents', label: `Sub-agents (${Object.keys(subAgents).length})` },
            { id: 'skills', label: `Skills (${Object.keys(skills).length})` },
            { id: 'commands', label: `Commands (${Object.keys(commands).length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'border-b-2 border-emerald-500 text-emerald-700'
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="min-h-[360px] pt-4">
          {activeTab === 'profile' && <ProfileTab form={form} onChange={onChangeForm} />}

          {activeTab === 'toolbox' && (
            <ToolboxTab
              form={form}
              onChange={onChangeForm}
              mcpServers={mcpServersJson}
              onMcpServersChange={onMcpServersChange}
            />
          )}

          {activeTab === 'agents' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-neutral-500">Sub-agents are triggered via Task tool.</p>
                <button
                  type="button"
                  onClick={onAddSubAgent}
                  className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
                >
                  + Add sub-agent
                </button>
              </div>
              {Object.keys(subAgents).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-black/10 bg-white/50 p-8 text-center">
                  <p className="text-sm text-neutral-500">No sub-agents defined.</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {Object.entries(subAgents).map(([name, agent]) => (
                    <SubAgentCard
                      key={name}
                      name={name}
                      agent={agent}
                      onEdit={onEditSubAgent}
                      onDelete={onDeleteSubAgent}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'skills' && <SkillsTab skills={skills} onChange={onChangeSkills} />}

          {activeTab === 'commands' && <CommandsTab commands={commands} onChange={onChangeCommands} />}
        </div>
      </div>
    </div>
  )
}
