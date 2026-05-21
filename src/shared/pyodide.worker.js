/**
 * Pyodide Web Worker — runs Python in a background thread so the main UI
 * never freezes, even on infinite loops. Terminate the worker to stop execution.
 *
 * Message protocol
 * ────────────────
 * Main → Worker : { type: 'init' }
 *                 { type: 'run',   code: string }
 *                 { type: 'input', value: string }
 *
 * Worker → Main : { type: 'progress',      msg: string }
 *                 { type: 'ready' }
 *                 { type: 'load_error',    msg: string }
 *                 { type: 'output',        text: string, kind: 'stdout'|'stderr' }
 *                 { type: 'input_required', prompt: string }
 *                 { type: 'done',          status: 'success'|'error' }
 */

const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'

let pyodide = null
let _inputResolve = null

// Python wrapper — same AST-transform approach as before, but now running in a Worker.
// `import js as _js` gives access to this worker's globalThis.
const WRAPPER = `
import js as _js
import sys, builtins, ast

async def _hs_input(prompt=''):
    val = await _js.__hsInput(str(prompt) if prompt else '')
    return str(val).rstrip('\\n')

builtins.input = _hs_input

class _Tx(ast.NodeTransformer):
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

// Expose input handler on the worker global so Python can call it via `import js`
globalThis.__hsInput = async (prompt) => {
  return new Promise((resolve) => {
    if (prompt) self.postMessage({ type: 'output', text: String(prompt), kind: 'stdout' })
    self.postMessage({ type: 'input_required', prompt: String(prompt) })
    _inputResolve = resolve
  })
}

self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try {
      await loadPyodide_()
      self.postMessage({ type: 'ready' })
    } catch (err) {
      self.postMessage({ type: 'load_error', msg: String(err) })
    }
    return
  }

  if (data.type === 'run') {
    if (!pyodide) {
      try {
        await loadPyodide_()
      } catch {
        self.postMessage({ type: 'done', status: 'error' })
        return
      }
    }

    _inputResolve = null

    pyodide.setStdout({
      batched: line => self.postMessage({ type: 'output', text: line + '\n', kind: 'stdout' }),
    })
    pyodide.setStderr({
      batched: line => self.postMessage({ type: 'output', text: line + '\n', kind: 'stderr' }),
    })

    pyodide.globals.set('_hs_user_code', data.code)

    try {
      await pyodide.runPythonAsync(WRAPPER)
      self.postMessage({ type: 'done', status: 'success' })
    } catch (err) {
      const msg = String(err).replace(/^PythonError:\s*/, '')
      self.postMessage({ type: 'output', text: msg + '\n', kind: 'stderr' })
      self.postMessage({ type: 'done', status: 'error' })
    }
    return
  }

  if (data.type === 'input') {
    _inputResolve?.(String(data.value))
    _inputResolve = null
    return
  }
}

async function loadPyodide_() {
  if (pyodide) return
  self.postMessage({ type: 'progress', msg: 'Loading Python…' })
  // @vite-ignore — dynamic CDN import, not bundled
  const { loadPyodide } = await import(/* @vite-ignore */ PYODIDE_CDN + 'pyodide.mjs')
  self.postMessage({ type: 'progress', msg: 'Starting Python runtime…' })
  pyodide = await loadPyodide({ indexURL: PYODIDE_CDN })
}
