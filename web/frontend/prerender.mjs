import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createServer } from 'vite'

const root = resolve(process.cwd())
const server = await createServer({
  root,
  logLevel: 'error',
  server: { middlewareMode: true },
  appType: 'custom',
})

try {
  const { renderApp } = await server.ssrLoadModule('/src/prerender.tsx')
  const appHtml = await renderApp()
  const distHtmlPath = resolve(root, 'dist/index.html')
  const template = await readFile(distHtmlPath, 'utf8')
  if (!template.includes('<div id="root"></div>')) {
    throw new Error('dist/index.html does not contain the root container')
  }
  const hydrated = template.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`)
  await writeFile(distHtmlPath, hydrated)
  console.log('Prerendered landing content into dist/index.html')
} finally {
  await server.close()
}
