/**
 * Formats caught backend errors into clean, user-friendly descriptions.
 * Prevents raw Postgres/Drizzle constraint strings (e.g. `duplicate key value violates unique constraint "users_cognito_sub_unique"`)
 * from leaking into client responses or toast notifications.
 */
export function formatErrorMessage(err: unknown, defaultMessage = 'An unexpected error occurred'): string {
  if (!err) return defaultMessage

  let msg = ''
  if (typeof err === 'string') {
    msg = err
  } else if (err instanceof Error) {
    msg = err.message
  } else if (typeof err === 'object' && err !== null) {
    const raw = (err as { message?: string; detail?: string }).detail || (err as { message?: string }).message
    if (typeof raw === 'string') msg = raw
  }

  if (!msg) return defaultMessage

  const lower = msg.toLowerCase()

  // Postgres unique constraint violations
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

  // Postgres foreign key constraint violations
  if (lower.includes('violates foreign key constraint')) {
    return 'This record cannot be deleted or modified because it is currently referenced by other items.'
  }

  // Postgres null constraint violations
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
