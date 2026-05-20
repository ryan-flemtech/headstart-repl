/**
 * Converts an array of file objects into a sandboxed iframe src URL.
 * Each file becomes a Blob URL; cross-references in the entry HTML are
 * rewritten before injection so that href/src attributes resolve correctly.
 *
 * Asset references (paths in `assets`) that don't match any editable file
 * are rewritten to their static server URL: `assetsPath + assetPath`.
 */
export function buildIframeSrc(files, entryFile = 'index.html', { assets = [], assetsPath = '' } = {}) {
  if (!files || files.length === 0) return null

  // Build filename → Blob URL map for editable files
  const blobUrls = {}
  for (const file of files) {
    const mime = getMime(file.type || file.name)
    const blob = new Blob([file.content], { type: mime })
    blobUrls[file.name] = URL.createObjectURL(blob)
  }

  // Find entry HTML file
  const entry = files.find(f => f.name === entryFile)
    ?? files.find(f => f.type === 'html' || f.name.endsWith('.html'))
  if (!entry) return null

  // Rewrite href/src references to other editable files → Blob URLs
  let html = entry.content
  for (const [name, url] of Object.entries(blobUrls)) {
    if (name === entry.name) continue
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    html = html.replace(
      new RegExp(`(href|src)=["']${escaped}["']`, 'g'),
      `$1="${url}"`,
    )
  }

  // Rewrite asset references → static server URLs
  if (assetsPath && assets.length > 0) {
    for (const assetPath of assets) {
      // Match the raw path as the student would write it
      const escaped = assetPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      // Encode each path segment so spaces and special chars are valid in URLs
      const encodedAssetPath = assetPath.split('/').map(encodeURIComponent).join('/')
      const staticUrl = assetsPath + encodedAssetPath
      html = html.replace(
        new RegExp(`(href|src)=["']${escaped}["']`, 'g'),
        `$1="${staticUrl}"`,
      )
    }
  }

  // Return new Blob URL for the rewritten HTML
  const rewrittenBlob = new Blob([html], { type: 'text/html' })
  return URL.createObjectURL(rewrittenBlob)
}

/** Extract visible text from an iframe's body (for output_contains checks). */
export function getIframeText(iframeEl) {
  try {
    return iframeEl?.contentDocument?.body?.innerText ?? ''
  } catch {
    return ''
  }
}

function getMime(typeOrName) {
  if (typeOrName === 'html'       || typeOrName.endsWith('.html')) return 'text/html'
  if (typeOrName === 'css'        || typeOrName.endsWith('.css'))  return 'text/css'
  if (typeOrName === 'javascript' || typeOrName.endsWith('.js'))   return 'application/javascript'
  return 'text/plain'
}
