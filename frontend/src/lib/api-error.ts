/**
 * Utility to extract and sanitize API errors for toast notifications.
 * Transforms raw database errors (e.g. `duplicate key value violates unique constraint "users_cognito_sub_unique"`)
 * into clear, user-friendly descriptions.
 */
export function apiError(err: unknown, fallback: string): string {
  const dataError = (err as { response?: { data?: { error?: unknown } } })?.response?.data?.error

  let rawMsg = ''
  if (typeof dataError === 'string') {
    rawMsg = dataError
  } else if (dataError && typeof dataError === 'object') {
    if ('formErrors' in dataError && Array.isArray((dataError as { formErrors?: unknown[] }).formErrors)) {
      const fe = (dataError as { formErrors?: string[] }).formErrors
      if (fe && fe.length > 0 && typeof fe[0] === 'string') rawMsg = fe[0]
    } else if ('fieldErrors' in dataError && typeof (dataError as { fieldErrors?: Record<string, string[]> }).fieldErrors === 'object') {
      const fe = (dataError as { fieldErrors?: Record<string, string[]> }).fieldErrors
      if (fe) {
        const firstKey = Object.keys(fe)[0]
        if (firstKey && Array.isArray(fe[firstKey]) && fe[firstKey][0]) {
          rawMsg = `${firstKey}: ${fe[firstKey][0]}`
        }
      }
    }
  }

  if (!rawMsg) {
    if (err instanceof Error) {
      rawMsg = err.message
    } else if (typeof err === 'string') {
      rawMsg = err
    } else {
      rawMsg = fallback
    }
  }

  return cleanErrorMessage(rawMsg, fallback)
}

export function cleanErrorMessage(msg: string, fallback: string): string {
  if (!msg) return fallback

  const lower = msg.toLowerCase()

  // Unique constraint violations
  if (lower.includes('duplicate key value violates unique constraint') || lower.includes('violates unique constraint')) {
    if (lower.includes('users_cognito_sub_unique') || lower.includes('users_email_unique') || lower.includes('users_email')) {
      return 'An account with this email address or user identity already exists.'
    }
    if (lower.includes('tenants_slug')) {
      return 'A workspace with this URL slug already exists.'
    }
    if (lower.includes('companies_slug')) {
      return 'A company with this URL slug already exists.'
    }
    if (lower.includes('coupons_code')) {
      return 'A coupon with this code already exists.'
    }
    return 'A record with this information already exists.'
  }

  // Foreign key constraint violations
  if (lower.includes('violates foreign key constraint')) {
    return 'This item cannot be deleted or modified because it is currently linked to other records.'
  }

  // Null constraint violations
  if (lower.includes('violates not-null constraint') || lower.includes('null value in column')) {
    return 'Please fill in all required fields.'
  }

  // Check constraint violations
  if (lower.includes('violates check constraint')) {
    return 'One or more values entered do not meet required conditions.'
  }

  // Value length or syntax errors
  if (lower.includes('value too long') || lower.includes('invalid input syntax')) {
    return 'One of the provided values is invalid or too long.'
  }

  // Generic DB syntax/relation/connection errors
  if (
    lower.includes('syntax error at or near') ||
    (lower.includes('relation') && lower.includes('does not exist')) ||
    lower.includes('deadlock detected') ||
    lower.includes('econnrefused')
  ) {
    return 'A database error occurred. Please try again or contact support.'
  }

  return msg
}
