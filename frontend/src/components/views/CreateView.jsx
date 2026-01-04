import { ProfileTab } from '../tabs/ProfileTab'
import { ToolboxTab } from '../tabs/ToolboxTab'
import { SkillsTab } from '../tabs/SkillsTab'
import { CommandsTab } from '../tabs/CommandsTab'
import { SubAgentCard } from '../SubAgentCard'
import { PreviewPanel } from '../PreviewPanel'

function CreateView({
  launching,
  onLaunch,
  canGoToRun,
  onGoToRun,
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
            <h2 className="section-title">创建 Agent</h2>
            <p className="mt-2 text-sm text-neutral-500">
              可快速启动，也可进入完整配置。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-70"
              onClick={onLaunch}
              disabled={launching}
            >
              {launching ? '启动中...' : '启动 Agent'}
            </button>
            <button
              className="rounded-full border border-black/10 bg-white/80 px-5 py-2 text-sm font-semibold text-neutral-700 transition hover:-translate-y-0.5 hover:border-black/20 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={onGoToRun}
              disabled={!canGoToRun}
            >
              前往运行时
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-black/10 bg-white/80 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-500">快速创建</p>
            <h3 className="mt-3 text-lg font-semibold text-neutral-900">快速创建</h3>
            <p className="mt-2 text-sm text-neutral-500">
              使用当前默认配置，几秒内启动可运行的 Agent。
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
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-500">向导设置</p>
            <h3 className="mt-3 text-lg font-semibold text-neutral-900">向导创建</h3>
            <p className="mt-2 text-sm text-neutral-500">
              按步骤配置工具、技能与提示词。
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
          <summary className="cursor-pointer text-sm font-semibold text-neutral-700">可选模块</summary>
          <div className="mt-3 grid gap-3 text-sm text-neutral-600 md:grid-cols-2">
            <div className="rounded-xl border border-black/5 bg-white/80 p-3">
              MCP Server 套件，可按部署开启或关闭。
            </div>
            <div className="rounded-xl border border-black/5 bg-white/80 p-3">
              预置技能与 Slash 命令包。
            </div>
          </div>
        </details>

        <details className="rounded-2xl border border-black/10 bg-white/80 px-5 py-4">
          <summary className="cursor-pointer text-sm font-semibold text-neutral-700">
            高级配置
          </summary>
          <div className="mt-5 space-y-5">
            <div className="flex border-b border-black/10">
              {[
                { id: 'profile', label: '资料' },
                { id: 'toolbox', label: '工具箱' },
                { id: 'agents', label: `子 Agent (${Object.keys(subAgents).length})` },
                { id: 'skills', label: `技能 (${Object.keys(skills).length})` },
                { id: 'commands', label: `命令 (${Object.keys(commands).length})` },
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
                      子 Agent 通过 Task 工具按描述触发。
                    </p>
                    <button
                      type="button"
                      onClick={onAddSubAgent}
                      className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
                    >
                      + 添加子 Agent
                    </button>
                  </div>
                  {Object.keys(subAgents).length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-black/10 bg-white/50 p-8 text-center">
                      <p className="text-sm text-neutral-500">尚未定义子 Agent。</p>
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
            <h2 className="section-title">配置预览</h2>
            <p className="mt-1 text-xs text-neutral-500">启动配置的实时快照。</p>
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
