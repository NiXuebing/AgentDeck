import { render, screen } from '@testing-library/react'
import { ChatMessage } from '../components/workbench/ChatMessage'

it('renders markdown headings for assistant messages', () => {
  render(<ChatMessage message={{ role: 'assistant', content: '# Title' }} />)
  expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
})
