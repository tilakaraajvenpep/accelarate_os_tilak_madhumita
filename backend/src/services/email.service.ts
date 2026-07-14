import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

const REGION = process.env.AWS_REGION || 'ap-southeast-1'
const FROM_EMAIL = process.env.AWS_SES_FROM_EMAIL

const getClient = () => new SESClient({ region: REGION })

export async function sendOtpEmail(to: string, code: string) {
  if (!FROM_EMAIL) {
    throw new Error('AWS_SES_FROM_EMAIL is not set in the environment')
  }

  await getClient().send(
    new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: 'Your AccelerateOS verification code' },
        Body: {
          Text: {
            Data: `Your verification code is ${code}. It expires in 10 minutes.\n\nIf you didn't request this, you can ignore this email.`,
          },
        },
      },
    }),
  )
}
