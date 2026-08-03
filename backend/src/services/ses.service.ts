import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

let client: SESClient | null = null

function getClient(): SESClient {
  if (!client) {
    const region = process.env.AWS_REGION || 'ap-southeast-1'
    client = new SESClient({ region })
  }
  return client
}

export async function sendVerificationEmail(params: { to: string; tenantName: string; code: string }) {
  const from = process.env.AWS_SES_FROM_EMAIL
  if (!from) throw new Error('AWS_SES_FROM_EMAIL is not set')

  const ses = getClient()
  const subject = `Verify your email for ${params.tenantName} on AOS`
  const text = `You're setting up an admin account for ${params.tenantName} on AOS.\n\nEnter this code where you were asked to verify your email:\n\n${params.code}\n\nThis code expires in 10 minutes.`
  const html = `<p>You're setting up an admin account for <strong>${params.tenantName}</strong> on AOS.</p><p>Enter this code where you were asked to verify your email:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${params.code}</p><p>This code expires in 10 minutes.</p>`

  await ses.send(
    new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: [params.to] },
      Message: {
        Subject: { Data: subject },
        Body: {
          Text: { Data: text },
          Html: { Data: html },
        },
      },
    }),
  )
}

export async function sendSuperAdminOtpEmail(params: { to: string; code: string }) {
  const from = process.env.AWS_SES_FROM_EMAIL
  if (!from) throw new Error('AWS_SES_FROM_EMAIL is not set')

  const ses = getClient()
  const subject = 'Verify your email — AccelerateOS super admin'
  const text = `Use this code to verify your email and activate your AccelerateOS super admin account:\n\n${params.code}\n\nThis code expires in 24 hours.`
  const html = `<p>Use this code to verify your email and activate your AccelerateOS super admin account:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${params.code}</p><p>This code expires in 24 hours.</p>`

  await ses.send(
    new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: [params.to] },
      Message: {
        Subject: { Data: subject },
        Body: {
          Text: { Data: text },
          Html: { Data: html },
        },
      },
    }),
  )
}

export async function sendCompanyInviteEmail(params: { to: string; name: string; tenantName: string; inviteUrl: string }) {
  const from = process.env.AWS_SES_FROM_EMAIL
  if (!from) throw new Error('AWS_SES_FROM_EMAIL is not set')

  const ses = getClient()
  const subject = `You're invited to join ${params.tenantName} on AOS`
  const text = `Hi ${params.name},\n\n${params.tenantName} has invited you to set up your company profile on AccelerateOS.\n\nGet started here:\n${params.inviteUrl}\n\nThis link expires in 7 days.`
  const html = `<p>Hi ${params.name},</p><p><strong>${params.tenantName}</strong> has invited you to set up your company profile on AccelerateOS.</p><p><a href="${params.inviteUrl}">Click here to get started</a></p><p>This link expires in 7 days.</p>`

  await ses.send(
    new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: [params.to] },
      Message: {
        Subject: { Data: subject },
        Body: {
          Text: { Data: text },
          Html: { Data: html },
        },
      },
    }),
  )
}

export async function sendMentorInviteEmail(params: { to: string; name: string; tenantName: string; inviteUrl: string }) {
  const from = process.env.AWS_SES_FROM_EMAIL
  if (!from) throw new Error('AWS_SES_FROM_EMAIL is not set')

  const ses = getClient()
  const subject = `You're invited to mentor at ${params.tenantName} on AOS`
  const text = `Hi ${params.name},\n\n${params.tenantName} has invited you to join as a mentor on AccelerateOS.\n\nGet started here:\n${params.inviteUrl}\n\nThis link expires in 7 days.`
  const html = `<p>Hi ${params.name},</p><p><strong>${params.tenantName}</strong> has invited you to join as a mentor on AccelerateOS.</p><p><a href="${params.inviteUrl}">Click here to get started</a></p><p>This link expires in 7 days.</p>`

  await ses.send(
    new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: [params.to] },
      Message: {
        Subject: { Data: subject },
        Body: {
          Text: { Data: text },
          Html: { Data: html },
        },
      },
    }),
  )
}

export async function sendCompanyMemberInviteEmail(params: {
  to: string
  inviterName: string
  companyName: string
  code: string
  acceptUrl: string
}) {
  const from = process.env.AWS_SES_FROM_EMAIL
  if (!from) throw new Error('AWS_SES_FROM_EMAIL is not set')

  const ses = getClient()
  const subject = `You're invited to join ${params.companyName} on AOS`
  const text = `Hi,\n\n${params.inviterName} has invited you to join ${params.companyName} as a co-founder on AccelerateOS.\n\nGet started here:\n${params.acceptUrl}\n\nYour verification code:\n\n${params.code}\n\nThis code expires in 7 days.`
  const html = `<p>Hi,</p><p><strong>${params.inviterName}</strong> has invited you to join <strong>${params.companyName}</strong> as a co-founder on AccelerateOS.</p><p><a href="${params.acceptUrl}">Click here to get started</a></p><p>Your verification code:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${params.code}</p><p>This code expires in 7 days.</p>`

  await ses.send(
    new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: [params.to] },
      Message: {
        Subject: { Data: subject },
        Body: {
          Text: { Data: text },
          Html: { Data: html },
        },
      },
    }),
  )
}

export async function sendCohortEventReminderEmail(params: {
  to: string
  name: string
  eventTitle: string
  eventDate: string
  cohortName: string
}) {
  const from = process.env.AWS_SES_FROM_EMAIL
  if (!from) throw new Error('AWS_SES_FROM_EMAIL is not set')

  const ses = getClient()
  const subject = `Reminder: "${params.eventTitle}" is coming up on ${params.eventDate}`
  const text = `Hi ${params.name},\n\nThis is a reminder that "${params.eventTitle}" for your cohort (${params.cohortName}) is scheduled for ${params.eventDate} — just 3 days away.\n\nMake sure you're ready for it.`
  const html = `<p>Hi ${params.name},</p><p>This is a reminder that <strong>${params.eventTitle}</strong> for your cohort (${params.cohortName}) is scheduled for <strong>${params.eventDate}</strong> — just 3 days away.</p><p>Make sure you're ready for it.</p>`

  await ses.send(
    new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: [params.to] },
      Message: {
        Subject: { Data: subject },
        Body: {
          Text: { Data: text },
          Html: { Data: html },
        },
      },
    }),
  )
}

export async function sendFormUpdatedNotice(params: { to: string; founderName: string; formTitle: string; tenantName: string }) {
  const from = process.env.AWS_SES_FROM_EMAIL
  if (!from) throw new Error('AWS_SES_FROM_EMAIL is not set')

  const ses = getClient()
  const subject = `"${params.formTitle}" was updated — please fill it in again`
  const text = `Hi ${params.founderName},\n\n${params.tenantName} updated the questions on "${params.formTitle}" since you last submitted it. Please sign in to AOS and fill it in again with the new questions.`
  const html = `<p>Hi ${params.founderName},</p><p><strong>${params.tenantName}</strong> updated the questions on <strong>${params.formTitle}</strong> since you last submitted it. Please sign in to AOS and fill it in again with the new questions.</p>`

  await ses.send(
    new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: [params.to] },
      Message: {
        Subject: { Data: subject },
        Body: {
          Text: { Data: text },
          Html: { Data: html },
        },
      },
    }),
  )
}

export async function sendSuperAdminEmailChangedNotice(params: { to: string; tempPassword: string }) {
  const from = process.env.AWS_SES_FROM_EMAIL
  if (!from) throw new Error('AWS_SES_FROM_EMAIL is not set')

  const ses = getClient()
  const subject = 'Your AccelerateOS super admin login email changed'
  const text = `Your super admin login email was changed to this address by another super admin.\n\nTemporary password: ${params.tempPassword}\n\nSign in with it, then use "Forgot password" to set your own.`
  const html = `<p>Your super admin login email was changed to this address by another super admin.</p><p>Temporary password: <strong>${params.tempPassword}</strong></p><p>Sign in with it, then use "Forgot password" to set your own.</p>`

  await ses.send(
    new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: [params.to] },
      Message: {
        Subject: { Data: subject },
        Body: {
          Text: { Data: text },
          Html: { Data: html },
        },
      },
    }),
  )
}

export async function sendPillarSubmissionNotice(params: {
  to: string
  mentorName: string
  founderName: string
  companyName: string
  pillarTitle: string
  type: 'takeaway' | 'discussion'
  content: string
}) {
  const from = process.env.AWS_SES_FROM_EMAIL
  if (!from) throw new Error('AWS_SES_FROM_EMAIL is not set')

  const ses = getClient()
  const submissionType = params.type === 'takeaway' ? 'Key Takeaway' : 'Discussion Comment'
  const subject = `New ${submissionType} submitted by ${params.companyName} on Pillar "${params.pillarTitle}"`
  const text = `Hi ${params.mentorName},\n\n${params.founderName} from ${params.companyName} has submitted a new ${submissionType} for the pillar "${params.pillarTitle}":\n\n"${params.content}"\n\nLog in to AccelerateOS to view and respond.`
  const html = `<p>Hi ${params.mentorName},</p><p><strong>${params.founderName}</strong> from <strong>${params.companyName}</strong> has submitted a new ${submissionType} for the pillar <strong>"${params.pillarTitle}"</strong>:</p><blockquote style="border-left: 4px solid #ccc; padding-left: 10px; font-style: italic;">${params.content}</blockquote><p>Log in to AccelerateOS to view and respond.</p>`

  await ses.send(
    new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: [params.to] },
      Message: {
        Subject: { Data: subject },
        Body: {
          Text: { Data: text },
          Html: { Data: html },
        },
      },
    }),
  )
}
