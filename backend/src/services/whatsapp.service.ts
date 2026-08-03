/**
 * No WhatsApp Business provider is configured yet — sending a business-
 * initiated WhatsApp message requires a registered Twilio or Meta Cloud API
 * account plus a pre-approved message template, neither of which exists for
 * this deployment. This is a safe no-op placeholder: the rest of the
 * reminder pipeline (cohort-reminders.service.ts) already calls this exact
 * function signature, so wiring in a real provider later is a drop-in
 * replacement of this function body — no callers need to change.
 *
 * Note: `users` also has no phone-number column yet; that would need to be
 * added alongside whichever provider gets configured.
 */
export async function sendWhatsAppReminder(params: {
  to: string | null
  eventTitle: string
  eventDate: string
}): Promise<{ sent: boolean; reason?: string }> {
  if (!process.env.WHATSAPP_PROVIDER) {
    console.log(`[whatsapp] skipped (no provider configured) — would have reminded ${params.to ?? 'an unknown number'} about "${params.eventTitle}" on ${params.eventDate}`)
    return { sent: false, reason: 'not_configured' }
  }

  // Future: branch on process.env.WHATSAPP_PROVIDER ('twilio' | 'meta') and call the real API here.
  return { sent: false, reason: 'not_configured' }
}
