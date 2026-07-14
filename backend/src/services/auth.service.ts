import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  GlobalSignOutCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  ResendConfirmationCodeCommand,
  ChangePasswordCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminGetUserCommand,
  AdminDeleteUserCommand,
  AuthFlowType,
} from '@aws-sdk/client-cognito-identity-provider'
import crypto from 'crypto'

const CLIENT_ID = process.env.COGNITO_CLIENT_ID!
const CLIENT_SECRET = process.env.COGNITO_CLIENT_SECRET
const REGION = process.env.COGNITO_REGION || process.env.AWS_REGION || 'ap-southeast-1'
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!

const getClient = () => new CognitoIdentityProviderClient({ region: REGION })

function secretHash(username: string): string | undefined {
  if (!CLIENT_SECRET) return undefined
  return crypto.createHmac('sha256', CLIENT_SECRET).update(username + CLIENT_ID).digest('base64')
}

export async function cognitoSignUp(email: string, password: string, name: string) {
  return getClient().send(
    new SignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      Password: password,
      SecretHash: secretHash(email),
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'name', Value: name },
      ],
    }),
  )
}

export async function cognitoConfirmSignUp(email: string, code: string) {
  return getClient().send(
    new ConfirmSignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      ConfirmationCode: code,
      SecretHash: secretHash(email),
    }),
  )
}

export async function cognitoSignIn(email: string, password: string) {
  const authParams: Record<string, string> = { USERNAME: email, PASSWORD: password }
  const hash = secretHash(email)
  if (hash) authParams.SECRET_HASH = hash

  return getClient().send(
    new InitiateAuthCommand({
      ClientId: CLIENT_ID,
      AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
      AuthParameters: authParams,
    }),
  )
}

export async function cognitoRefreshToken(email: string, refreshToken: string) {
  const authParams: Record<string, string> = { REFRESH_TOKEN: refreshToken }
  const hash = secretHash(email)
  if (hash) authParams.SECRET_HASH = hash

  return getClient().send(
    new InitiateAuthCommand({
      ClientId: CLIENT_ID,
      AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
      AuthParameters: authParams,
    }),
  )
}

export async function cognitoSignOut(accessToken: string) {
  return getClient().send(new GlobalSignOutCommand({ AccessToken: accessToken }))
}

export async function cognitoForgotPassword(email: string) {
  return getClient().send(
    new ForgotPasswordCommand({
      ClientId: CLIENT_ID,
      Username: email,
      SecretHash: secretHash(email),
    }),
  )
}

export async function cognitoConfirmForgotPassword(
  email: string,
  code: string,
  newPassword: string,
) {
  return getClient().send(
    new ConfirmForgotPasswordCommand({
      ClientId: CLIENT_ID,
      Username: email,
      ConfirmationCode: code,
      Password: newPassword,
      SecretHash: secretHash(email),
    }),
  )
}

export async function cognitoResendCode(email: string) {
  return getClient().send(
    new ResendConfirmationCodeCommand({
      ClientId: CLIENT_ID,
      Username: email,
      SecretHash: secretHash(email),
    }),
  )
}

export async function cognitoChangePassword(accessToken: string, previousPassword: string, proposedPassword: string) {
  return getClient().send(
    new ChangePasswordCommand({
      AccessToken: accessToken,
      PreviousPassword: previousPassword,
      ProposedPassword: proposedPassword,
    }),
  )
}

/** Admin-creates a Cognito user with a name attribute, no password set yet —
 * the password is set separately via cognitoAdminSetPassword right after. */
export async function cognitoAdminCreateUser(email: string, name: string) {
  return getClient().send(
    new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      MessageAction: 'SUPPRESS',
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'name', Value: name },
      ],
    }),
  )
}

export async function cognitoAdminSetPassword(email: string, password: string) {
  return getClient().send(
    new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      Password: password,
      Permanent: true,
    }),
  )
}

export async function cognitoAdminGetSub(email: string): Promise<string> {
  const details = await getClient().send(
    new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: email }),
  )
  const sub = details.UserAttributes?.find((a) => a.Name === 'sub')?.Value
  if (!sub) throw new Error('Could not resolve Cognito sub for the user')
  return sub
}

export async function cognitoAdminDeleteUser(email: string) {
  return getClient().send(new AdminDeleteUserCommand({ UserPoolId: USER_POOL_ID, Username: email }))
}
