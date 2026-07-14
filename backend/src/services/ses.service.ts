import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

let client: SESClient | null = null

function getClient(): SESClient {
  if (!client) {
    const region = process.env.AWS_REGION || 'ap-southeast-1'
    client = new SESClient({ region })
  }
  return client
}

export async function sendVerificationEmail(params: {
  to: string
  tenantName: string
  code: string
  verifyUrl: string
}) {
  const from = process.env.AWS_SES_FROM_EMAIL
  if (!from) throw new Error('AWS_SES_FROM_EMAIL is not set')

  const ses = getClient()
  const subject = `Verify your email for ${params.tenantName} on AOS`
  const text = `Your admin account for ${params.tenantName} on AOS is ready — sign in with the password you were given, once you verify this email.\n\nVerify by clicking: ${params.verifyUrl}\n\nOr enter this code manually: ${params.code}\n\nThis code expires in 24 hours.`
  const html = `<p>Your admin account for <strong>${params.tenantName}</strong> on AOS is ready — sign in with the password you were given, once you verify this email.</p><p><a href="${params.verifyUrl}">Verify my email</a></p><p>Or enter this code manually: <strong>${params.code}</strong></p><p>This code expires in 24 hours.</p>`

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
