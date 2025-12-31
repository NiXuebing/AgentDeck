// frontend/src/components/SubAgentCard.jsx

export function SubAgentCard({ name, agent, onEdit, onDelete }) {
  const toolCount = agent.allowed_tools?.length || agent.tools?.length || 0

  return (
    <div className="rounded-2xl border border-black/5 bg-white/70 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{agent.icon || '🤖'}</span>
          <div>
            <h4 className="font-semibold text-neutral-800">{name}</h4>
            <p className="text-xs text-neutral-500 line-clamp-2">
              {agent.description?.slice(0, 60)}
              {agent.description?.length > 60 ? '...' : ''}
            </p>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-neutral-400">
        <div className="flex gap-3">
          <span>Model: {agent.model || 'inherit'}</span>
          <span>Tools: {toolCount || 'inherit'}</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onEdit(name, agent)}
            className="rounded-lg border border-black/10 px-2.5 py-1 font-medium text-neutral-600 hover:bg-neutral-50"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(name)}
            className="rounded-lg border border-red-200 px-2.5 py-1 font-medium text-red-500 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
