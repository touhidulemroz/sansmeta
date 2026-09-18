import { renderToString } from 'react-dom/server'
import App from './App'

export function renderApp(): string {
  return renderToString(<App />)
}
