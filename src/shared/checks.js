export function normalizeChecks(check) {
  if (!check) return []
  if (Array.isArray(check)) return check.filter(c => c?.type)
  return [check]
}

export function evaluateSingleCheck(check, output, context = {}) {
  if (!check?.type) return false

  if (check.type === 'code_no_error') {
    return context.status === 'success'
  }

  if (check.type === 'output_not_empty') {
    return normalizeOutput(output).length > 0
  }

  if (check.value == null) return false

  if (check.type === 'output_equals') {
    return normalizeExactOutput(output) === normalizeExactOutput(check.value)
  }

  if (check.type === 'output_line_count') {
    return countOutputLines(output) === Number(check.value)
  }

  const actual = normalizeOutput(output)
  const expected = normalizeOutput(check.value)
  return actual.includes(expected)
}

export function evaluateCheck(check, output, context = {}) {
  const checks = normalizeChecks(check)
  if (checks.length === 0) return false
  return checks.every(c => evaluateSingleCheck(c, output, context))
}

function normalizeOutput(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n').trim().toLowerCase()
}

function normalizeExactOutput(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n').replace(/\n+$/, '').toLowerCase()
}

function countOutputLines(value) {
  const output = String(value ?? '').replace(/\r\n?/g, '\n')
  if (!output) return 0
  return output.replace(/\n$/, '').split('\n').length
}
