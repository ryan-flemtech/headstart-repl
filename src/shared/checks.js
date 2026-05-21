export function evaluateCheck(check, output) {
  if (!check?.type || check.value == null) return false

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
