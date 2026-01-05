import { render, screen } from '@testing-library/react'
import App from '../App'

it('renders the Workbench split layout', () => {
  render(<App />)
  expect(screen.getByTestId('blueprint-skeleton')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Stage' })).toBeInTheDocument()
})
