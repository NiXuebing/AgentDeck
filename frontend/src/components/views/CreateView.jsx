import { ProfileTab } from '../tabs/ProfileTab'
import { ToolboxTab } from '../tabs/ToolboxTab'
import { SkillsTab } from '../tabs/SkillsTab'
import { CommandsTab } from '../tabs/CommandsTab'
import { SubAgentCard } from '../SubAgentCard'
import { PreviewPanel } from '../PreviewPanel'

function CreateView({
  launching,
  onLaunch,
  activeConfigTab,
  onChangeConfigTab,
  form,
  onChangeForm,
  mcpServersJson,
  onMcpServersChange,
  subAgents,
  onAddSubAgent,
  onEditSubAgent,
  onDeleteSubAgent,
  skills,
  onChangeSkills,
  commands,
  onChangeCommands,
  previewConfig,
}) {
  return (
    <>
      <section className="glass reveal flex flex-col gap-6 p-6" style={{ '--delay': '140ms' }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="section-title">Create Agent</h2>
            <p className="mt-2 text-sm text-neutral-500">
              Start with a quick launch or dive into the full configuration.
            </p>
          </div>
          <button
            className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-neutral-800"
            onClick={onLaunch}
            disabled={launching}
          >
            {launching ? 'Launching...' : 'Launch Agent'}
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-black/10 bg-white/80 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-500">Quick Create</p>
            <h3 className="mt-3 text-lg font-semibold text-neutral-900">快速创建</h3>
            <p className="mt-2 text-sm text-neutral-500">
              Use the current defaults and launch a runnable agent in seconds.
            </p>
            <button
              className="mt-4 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-emerald-700"
              onClick={onLaunch}
              disabled={launching}
            >
              创建并启动
            </button>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-500">Guided Setup</p>
            <h3 className="mt-3 text-lg font-semibold text-neutral-900">向导创建</h3>
            <p className="mt-2 text-sm text-neutral-500">
              Walk through tools, skills, and prompt choices step-by-step.
            </p>
            <button
              className="mt-4 rounded-full border border-black/10 bg-white/90 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:-translate-y-0.5 hover:border-black/20"
              type="button"
            >
              打开向导
            </button>
          </div>
        </div>

        <details className="rounded-2xl border border-dashed border-black/10 bg-white/60 px-5 py-4">
          <summary className="cursor-pointer text-sm font-semibold text-neutral-700">Optional Modules</summary>
          <div className="mt-3 grid gap-3 text-sm text-neutral-600 md:grid-cols-2">
            <div className="rounded-xl border border-black/5 bg-white/80 p-3">
              MCP Server bundles, toggled per deployment.
            </div>
            <div className="rounded-xl border border-black/5 bg-white/80 p-3">
              Prewired skills and slash command packs.
            </div>
          </div>
        </details>

        <details className="rounded-2xl border border-black/10 bg-white/80 px-5 py-4">
          <summary className="cursor-pointer text-sm font-semibold text-neutral-700">
            Advanced Configuration
          </summary>
          <div className="mt-5 space-y-5">
            <div className="flex border-b border-black/10">
              {[
                { id: 'profile', label: 'Profile' },
                { id: 'toolbox', label: 'Toolbox' },
                { id: 'agents', label: `Sub-Agents (${Object.keys(subAgents).length})` },
                { id: 'skills', label: `Skills (${Object.keys(skills).length})` },
                { id: 'commands', label: `Commands (${Object.keys(commands).length})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onChangeConfigTab(tab.id)}
                  className={`px-4 py-2.5 text-sm font-medium transition ${
                    activeConfigTab === tab.id
                      ? 'border-b-2 border-emerald-500 text-emerald-700'
                      : 'text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="min-h-[400px]">
              {activeConfigTab === 'profile' && <ProfileTab form={form} onChange={onChangeForm} />}

              {activeConfigTab === 'toolbox' && (
                <ToolboxTab
                  form={form}
                  onChange={onChangeForm}
                  mcpServers={mcpServersJson}
                  onMcpServersChange={onMcpServersChange}
                />
              )}

              {activeConfigTab === 'agents' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-neutral-500">
                      Sub-agents are invoked via the Task tool based on their descriptions.
                    </p>
                    <button
                      type="button"
                      onClick={onAddSubAgent}
                      className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
                    >
                      + Add Sub-Agent
                    </button>
                  </div>
                  {Object.keys(subAgents).length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-black/10 bg-white/50 p-8 text-center">
                      <p className="text-sm text-neutral-500">No sub-agents defined yet.</p>
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

              {activeConfigTab === 'skills' && <SkillsTab skills={skills} onChange={onChangeSkills} />}

              {activeConfigTab === 'commands' && <CommandsTab commands={commands} onChange={onChangeCommands} />}
            </div>
          </div>
        </details>
      </section>

      <div className="flex flex-col gap-6">
        <section className="glass reveal flex flex-col gap-4 p-5" style={{ '--delay': '200ms' }}>
          <div>
            <h2 className="section-title">Config Preview</h2>
            <p className="mt-1 text-xs text-neutral-500">Live snapshot of the launch payload.</p>
          </div>
          <div className="h-[420px]">
            <PreviewPanel
              config={previewConfig}
              agents={subAgents}
              skills={skills}
              commands={commands}
            />
          </div>
        </section>
      </div>
    </>
  )
}

export default CreateView
