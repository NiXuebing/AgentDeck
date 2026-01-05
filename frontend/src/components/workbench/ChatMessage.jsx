import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { TOOL_LABELS } from '../../constants/tools'

export function ChatMessage({ message, onAddSuggestedTools, onRetry }) {
  const role = message?.role || 'assistant'

  if (role === 'system' || role === 'meta') {
    if (message?.metadata?.type === 'suggestion') {
      const tools = message.metadata.suggestedTools || []
      return (
        <div className="chat-meta">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-left text-emerald-700">
            <div className="text-xs font-semibold uppercase tracking-[0.2em]">Tool Suggestion</div>
            <p className="mt-2 text-sm">{message.metadata.reason || message.content}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {tools.map((tool) => (
                <span
                  key={tool}
                  className="rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-xs font-semibold"
                >
                  {TOOL_LABELS[tool] || tool}
                </span>
              ))}
            </div>
            <button
              type="button"
              className="mt-3 rounded-full bg-emerald-700 px-4 py-2 text-xs font-semibold text-white"
              onClick={() => onAddSuggestedTools?.(tools)}
            >
              Add tool
            </button>
          </div>
        </div>
      )
    }
    return (
      <div className="chat-meta">
        <span>{message.content}</span>
      </div>
    )
  }

  const isUser = role === 'user'
  const showRetry = role === 'assistant' && !message.streaming
  return (
    <div className={`chat-bubble ${isUser ? 'chat-user' : 'chat-agent'}`}>
      {isUser ? message.content : <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>}
      {showRetry && message.replyTo ? (
        <button
          type="button"
          className="mt-2 rounded-full border border-black/10 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-600"
          onClick={() => onRetry?.(message.replyTo)}
        >
          Retry
        </button>
      ) : null}
    </div>
  )
}
