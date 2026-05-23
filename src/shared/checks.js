export function normalizeChecks(check) {
  if (!check) return []
  if (Array.isArray(check)) return check.filter(c => c?.type)
  return [check]
}

export const CHECK_TYPES = {
  RUN_REQUIRED: [
    'code_no_error',
    'output_contains',
    'output_equals',
    'output_not_contains',
    'output_not_equals',
    'output_matches_regex',
    'output_line_count',
    'output_not_empty',
    'element_exists',
    'element_count',
    'element_value',
    'element_value_equals',
    'element_value_not_contains',
    'element_value_not_equals',
    'element_value_matches_regex',
  ],
  SUBMIT_ALLOWED: [
    'code_contains',
    'code_does_not_contain',
    'code_equals',
    'code_not_equals',
    'code_matches_regex',
  ],
}

export function checkRequiresRun(check) {
  return CHECK_TYPES.RUN_REQUIRED.includes(check?.type)
}

export function checkAllowedForSubmit(check) {
  return CHECK_TYPES.SUBMIT_ALLOWED.includes(check?.type)
}

export function filterChecksForInteraction(check, interactionMode) {
  const checks = normalizeChecks(check)
  if (interactionMode !== 'submit') return checks
  return checks.filter(checkAllowedForSubmit)
}

export function evaluateSingleCheck(check, output, context = {}) {
  if (!check?.type) return false

  if (check.type === 'code_no_error') {
    return context.status === 'success'
  }

  if (check.type === 'output_not_empty') {
    return normalizeOutput(output).length > 0
  }

  if (check.type === 'element_exists') {
    if (!context.iframeDoc || !check.selector) return false
    try { return context.iframeDoc.querySelectorAll(check.selector).length > 0 } catch { return false }
  }

  if (check.value == null) return false

  if (check.type === 'answer_equals') {
    return normalizeExactOutput(context.answer ?? output) === normalizeExactOutput(check.value)
  }

  if (check.type === 'answer_contains') {
    return normalizeOutput(context.answer ?? output).includes(normalizeOutput(check.value))
  }

  if (check.type === 'answer_not_contains') {
    return !normalizeOutput(context.answer ?? output).includes(normalizeOutput(check.value))
  }

  if (check.type === 'answer_matches_regex') {
    try { return new RegExp(check.value, 'i').test(String(context.answer ?? output)) } catch { return false }
  }

  if (check.type === 'output_equals') {
    return normalizeExactOutput(output) === normalizeExactOutput(check.value)
  }

  if (check.type === 'output_not_equals') {
    return normalizeExactOutput(output) !== normalizeExactOutput(check.value)
  }

  if (check.type === 'output_not_contains') {
    return !normalizeOutput(output).includes(normalizeOutput(check.value))
  }

  if (check.type === 'output_matches_regex') {
    try { return new RegExp(check.value).test(normalizeOutput(output)) } catch { return false }
  }

  if (check.type === 'output_line_count') {
    return countOutputLines(output) === Number(check.value)
  }

  if (check.type === 'code_contains') {
    return normalizeOutput(context.code ?? '').includes(normalizeOutput(check.value))
  }

  if (check.type === 'code_does_not_contain') {
    return !normalizeOutput(context.code ?? '').includes(normalizeOutput(check.value))
  }

  if (check.type === 'code_equals') {
    return normalizeExactOutput(context.code ?? '') === normalizeExactOutput(check.value)
  }

  if (check.type === 'code_not_equals') {
    return normalizeExactOutput(context.code ?? '') !== normalizeExactOutput(check.value)
  }

  if (check.type === 'code_matches_regex') {
    try { return new RegExp(check.value).test(normalizeOutput(context.code ?? '')) } catch { return false }
  }

  if (check.type === 'element_count') {
    if (!context.iframeDoc || !check.selector) return false
    try { return context.iframeDoc.querySelectorAll(check.selector).length === Number(check.value) } catch { return false }
  }

  if (check.type === 'element_value') {
    if (!context.iframeDoc || !check.selector) return false
    try {
      const el = context.iframeDoc.querySelector(check.selector)
      if (!el) return false
      const raw = getElementText(el)
      return normalizeOutput(raw).includes(normalizeOutput(check.value))
    } catch { return false }
  }

  if (check.type === 'element_value_equals') {
    if (!context.iframeDoc || !check.selector) return false
    try {
      const el = context.iframeDoc.querySelector(check.selector)
      if (!el) return false
      return normalizeOutput(getElementText(el)) === normalizeOutput(check.value)
    } catch { return false }
  }

  if (check.type === 'element_value_not_contains') {
    if (!context.iframeDoc || !check.selector) return false
    try {
      const el = context.iframeDoc.querySelector(check.selector)
      if (!el) return false
      return !normalizeOutput(getElementText(el)).includes(normalizeOutput(check.value))
    } catch { return false }
  }

  if (check.type === 'element_value_not_equals') {
    if (!context.iframeDoc || !check.selector) return false
    try {
      const el = context.iframeDoc.querySelector(check.selector)
      if (!el) return false
      return normalizeOutput(getElementText(el)) !== normalizeOutput(check.value)
    } catch { return false }
  }

  if (check.type === 'element_value_matches_regex') {
    if (!context.iframeDoc || !check.selector) return false
    try {
      const el = context.iframeDoc.querySelector(check.selector)
      if (!el) return false
      return new RegExp(check.value).test(normalizeOutput(getElementText(el)))
    } catch { return false }
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

export function evaluateCheckResults(check, output, context = {}) {
  return normalizeChecks(check).map(c => ({
    ...c,
    passed: evaluateSingleCheck(c, output, context),
  }))
}

export function getFirstFailedCheckHint(check, output, context = {}) {
  const failed = evaluateCheckResults(check, output, context)
    .find(result => !result.passed && String(result.hint ?? '').trim())
  return failed ? String(failed.hint).trim() : ''
}

// Evaluates only code-based checks (no run required). Safe to call without executing the code.
export function evaluateCheckWithCode(check, code) {
  const checks = normalizeChecks(check)
  if (checks.length === 0) return false
  if (!checks.every(checkAllowedForSubmit)) return false
  return checks.every(c => evaluateSingleCheck(c, '', { code }))
}

function getElementText(el) {
  const INPUT_TAGS = ['INPUT', 'TEXTAREA', 'SELECT']
  return INPUT_TAGS.includes(el.tagName) ? el.value : (el.textContent ?? '')
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
