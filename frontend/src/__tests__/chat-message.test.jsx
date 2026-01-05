import { render, screen } from '@testing-library/react'
import { ChatMessage } from '../components/workbench/ChatMessage'

it('renders meta messages in a centered meta container', () => {
  render(<ChatMessage message={{ role: 'meta', content: 'Tool Added' }} />)
  expect(screen.getByText('Tool Added')).toBeInTheDocument()
})
