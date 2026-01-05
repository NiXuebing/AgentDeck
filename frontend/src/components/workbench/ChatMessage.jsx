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
      {message.content}
    </div>
  )
}
