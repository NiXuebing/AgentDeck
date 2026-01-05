import { fireEvent, render, screen } from '@testing-library/react'
import App from '../App'

it('shows chat input and live logs toggle', () => {
  render(<App />)
  expect(screen.getByPlaceholderText(/Message/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Logs/i })).toBeInTheDocument()
})

it('updates the message input and opens the logs drawer', () => {
  render(<App />)
  const input = screen.getByPlaceholderText(/Message/i)
  fireEvent.change(input, { target: { value: 'Hello' } })
  expect(input).toHaveValue('Hello')

  fireEvent.click(screen.getByRole('button', { name: /Logs/i }))
  expect(screen.getByText(/Live logs/i)).toBeInTheDocument()
})
