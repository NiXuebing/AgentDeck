import { render, screen } from '@testing-library/react'
import App from '../App'

test('renders quick create entry', () => {
  render(<App />)
  expect(screen.getByText(/Launch Agent/i)).toBeInTheDocument()
})
