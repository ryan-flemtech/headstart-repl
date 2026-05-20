// Injected into every iframe HTML to relay console output to the parent via postMessage.
const CONSOLE_INTERCEPTOR = `<script>(function(){
  function post(level,args){
    try{window.parent.postMessage({source:'hsc-console',level:level,args:[].slice.call(args).map(function(x){
      if(x===null)return'null';if(x===undefined)return'undefined';
      try{return typeof x==='object'?JSON.stringify(x,null,2):String(x)}catch(e){return'[object]'}
    })},'*')}catch(e){}
  }
  ['log','info','warn','error'].forEach(function(m){
    var o=console[m].bind(console);
    console[m]=function(){o.apply(console,arguments);post(m,arguments)};
  });
  window.addEventListener('error',function(e){post('error',[e.message+(e.lineno?' (line '+e.lineno+')':'')])},true);
  window.addEventListener('unhandledrejection',function(e){post('error',['Unhandled promise: '+(e.reason&&e.reason.message||String(e.reason))])});
})()</script>`

// Tracks the load ID of the most recently built iframe src so waitForIframeText
// can match the postMessage from the correct iframe load.
let _lastLoadId = null

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

  // Inject security (CSP + console interceptor + text reporter)
  const loadId = Math.random().toString(36).slice(2)
  _lastLoadId = loadId
  html = _injectSecurity(html, loadId)

  // Return new Blob URL for the rewritten HTML
  const rewrittenBlob = new Blob([html], { type: 'text/html' })
  return URL.createObjectURL(rewrittenBlob)
}

/**
 * Returns a Promise that resolves to the iframe's body text once the injected
 * postMessage script fires after DOMContentLoaded. Matches against the load ID
 * set by the most recent buildIframeSrc call. Resolves to '' on timeout.
 */
export function waitForIframeText(timeout = 1500) {
  const expectedId = _lastLoadId
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      window.removeEventListener('message', handler)
      resolve('')
    }, timeout)

    function handler(event) {
      if (event.data?.type === '__hsc_text__' && event.data?.id === expectedId) {
        clearTimeout(timer)
        window.removeEventListener('message', handler)
        resolve(event.data.text ?? '')
      }
    }

    window.addEventListener('message', handler)
  })
}

function getMime(typeOrName) {
  if (typeOrName === 'html'       || typeOrName.endsWith('.html')) return 'text/html'
  if (typeOrName === 'css'        || typeOrName.endsWith('.css'))  return 'text/css'
  if (typeOrName === 'javascript' || typeOrName.endsWith('.js'))   return 'application/javascript'
  return 'text/plain'
}

function _injectSecurity(html, loadId) {
  // CSP blocks all outbound network requests (fetch, XHR, WebSocket).
  // blob: and 'unsafe-inline'/'unsafe-eval' are needed for the virtual filesystem
  // and typical student code patterns.
    const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline' blob:; connect-src 'self' ws://localhost:5173; img-src 'self' data: blob:;">`  // Text reporter: fires on DOMContentLoaded and posts body text to the parent.
  // The parent's waitForIframeText() listens for this message to run output_contains checks.
  const textReporter = `<script>(function(){var s=function(){try{window.parent.postMessage({type:'__hsc_text__',id:'${loadId}',text:document.body?document.body.innerText:''},'*')}catch(e){}};if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',s)}else{s()}})()</script>`

  // Inject CSP + console interceptor right after <head> (or prepend if no <head>)
  const headMatch = html.match(/<head[^>]*>/i)
  if (headMatch) {
    const pos = headMatch.index + headMatch[0].length
    html = html.slice(0, pos) + csp + CONSOLE_INTERCEPTOR + html.slice(pos)
  } else {
    html = '<head>' + csp + '</head>' + CONSOLE_INTERCEPTOR + html
  }

  // Inject text reporter before </body> (or append if no </body>)
  if (/<\/body>/i.test(html)) {
    html = html.replace(/<\/body>/i, textReporter + '</body>')
  } else {
    html += textReporter
  }

  return html
}
