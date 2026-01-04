import { render, screen } from '@testing-library/react'
import App from '../App'

test('renders quick create entry', () => {
  render(<App />)
  expect(screen.getByText(/Launch Agent/i)).toBeInTheDocument()
})

test('create view shows quick create card and wizard entry', () => {
  render(<App />)
  expect(screen.getByText(/快速创建/i)).toBeInTheDocument()
  expect(screen.getByText(/向导创建/i)).toBeInTheDocument()
})
