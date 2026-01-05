import { render, screen } from '@testing-library/react'
import App from '../App'

it('shows blueprint skeleton before genesis fills', () => {
  render(<App />)
  expect(screen.getByTestId('blueprint-skeleton')).toBeInTheDocument()
})
