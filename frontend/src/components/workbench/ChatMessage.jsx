import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function ChatMessage({ message }) {
  const role = message?.role || 'assistant'

  if (role === 'system' || role === 'meta') {
    return (
      <div className="chat-meta">
        <span>{message.content}</span>
      </div>
    )
  }

  const isUser = role === 'user'
  return (
    <div className={`chat-bubble ${isUser ? 'chat-user' : 'chat-agent'}`}>
      {isUser ? message.content : <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>}
    </div>
  )
}
