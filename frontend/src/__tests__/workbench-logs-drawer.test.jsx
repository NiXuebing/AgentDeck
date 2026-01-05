import { fireEvent, render, screen } from '@testing-library/react'
import App from '../App'

it('opens logs drawer at bottom', async () => {
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: /Logs/i }))
  expect(screen.getByTestId('logs-drawer')).toBeInTheDocument()
})
