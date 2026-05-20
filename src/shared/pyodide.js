/**
 * Shared Pyodide loader and execution module.
 *
 * input() handling: user code is run inside an async Python function.
 * The AST transformer converts every input() call to an awaited async version,
 * and every `def` to `async def`, so input() works at any depth.
 *
 * Remaining limitation: calls to user-defined functions are NOT auto-awaited,
 * so a user function that calls input() must itself be called with `await` in
 * the student's code. Lessons should avoid this pattern; top-level input()
 * calls (the vast majority of classroom code) work correctly.
 */

const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'

let pyodide = null
let loadingPromise = null

// Queue of resolvers for pending input() calls
let _inputResolvers = []

// ─── Loader ──────────────────────────────────────────────────────────────────

export async function initPyodide(onProgress) {
  if (pyodide) return pyodide
  if (loadingPromise) return loadingPromise

  loadingPromise = (async () => {
    onProgress?.('Loading Python…')
    if (!window.loadPyodide) {
      await loadScript(PYODIDE_CDN + 'pyodide.js')
    }
    onProgress?.('Starting Python runtime…')
    pyodide = await window.loadPyodide({ indexURL: PYODIDE_CDN })
    onProgress?.('Python ready')
    return pyodide
  })()

  try {
    return await loadingPromise
  } catch (err) {
    loadingPromise = null
    throw err
  }
}

export function isPyodideReady() {
  return !!pyodide
}

// ─── Input bridge ─────────────────────────────────────────────────────────────

/** Called from the OutputPanel UI when the student submits their input. */
export function provideInput(text) {
  const resolve = _inputResolvers.shift()
  if (resolve) resolve(text)
}

// ─── Runner ──────────────────────────────────────────────────────────────────

/**
 * Run a Python code string.
 * @param {string} code
 * @param {{ onOutput, onInputRequired }} callbacks
 *   onOutput(text, kind)  — kind is 'stdout' | 'stderr'
 *   onInputRequired(prompt) — called when input() is waiting; resolve with provideInput()
 */
export async function runPython(code, { onOutput, onInputRequired } = {}) {
  if (!pyodide) throw new Error('Pyodide not initialised — call initPyodide first')

  _inputResolvers = []

  pyodide.setStdout({ batched: line => onOutput?.(line + '\n', 'stdout') })
  pyodide.setStderr({ batched: line => onOutput?.(line + '\n', 'stderr') })

  // JS-side async input handler called from Python
  window.__hsInput = async (prompt) => {
    return new Promise(resolve => {
      // Display the prompt string immediately before the input field appears.
      // Cannot rely on sys.stdout.write here — Pyodide's batched stdout only
      // flushes on newline, so a prompt without '\n' would never appear.
      if (prompt) onOutput?.(String(prompt), 'stdout')
      _inputResolvers.push(resolve)
      onInputRequired?.(String(prompt))
    })
  }

  // Pass code to Python without string-escaping worries
  pyodide.globals.set('_hs_user_code', code)

  // Python wrapper: AST-transforms user code, wraps in async, runs it
  const wrapper = `
import js as _js
import sys, builtins, ast

async def _hs_input(prompt=''):
    val = await _js.__hsInput(str(prompt) if prompt else '')
    return str(val).rstrip('\\n')

builtins.input = _hs_input  # fallback for any non-transformed call sites

class _Tx(ast.NodeTransformer):
    """Wrap input() in await; convert def → async def."""
    def visit_Call(self, node):
        self.generic_visit(node)
        if isinstance(node.func, ast.Name) and node.func.id == 'input':
            return ast.Await(value=node)
        return node
    def visit_FunctionDef(self, node):
        self.generic_visit(node)
        new = ast.AsyncFunctionDef(
            name=node.name, args=node.args, body=node.body,
            decorator_list=node.decorator_list, returns=node.returns,
            lineno=node.lineno, col_offset=node.col_offset,
            type_comment=getattr(node, 'type_comment', None),
        )
        ast.copy_location(new, node)
        return new

_tree = ast.parse(_hs_user_code)
_Tx().visit(_tree)
ast.fix_missing_locations(_tree)

_fn = ast.AsyncFunctionDef(
    name='__hs_run__',
    args=ast.arguments(
        posonlyargs=[], args=[], vararg=None,
        kwonlyargs=[], kw_defaults=[], kwarg=None, defaults=[],
    ),
    body=_tree.body,
    decorator_list=[],
    returns=None,
    lineno=1, col_offset=0,
    type_comment=None,
)
ast.fix_missing_locations(_fn)
_mod = ast.Module(body=[_fn], type_ignores=[])
ast.fix_missing_locations(_mod)

_g = {
    '_hs_input': _hs_input,
    '__builtins__': builtins,
    '__name__': '__main__',
}
exec(compile(_mod, '<student>', 'exec'), _g)
await _g['__hs_run__']()
`

  try {
    await pyodide.runPythonAsync(wrapper)
    return { status: 'success' }
  } catch (err) {
    const msg = String(err).replace(/^PythonError:\s*/, '')
    onOutput?.(msg + '\n', 'stderr')
    return { status: 'error', error: msg }
  }
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.onload = resolve
    s.onerror = reject
    document.head.appendChild(s)
  })
}
