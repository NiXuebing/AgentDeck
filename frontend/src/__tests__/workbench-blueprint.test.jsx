import { render, screen } from '@testing-library/react'
import App from '../App'

it('shows prompt editor with unsaved indicator', () => {
  render(<App />)
  expect(screen.getByLabelText(/System Prompt/i)).toBeInTheDocument()
  expect(screen.getByText(/Unsaved/i)).toBeInTheDocument()
})
