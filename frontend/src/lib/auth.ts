"use client";

import { Amplify } from "aws-amplify";
import {
  type AuthSession,
  confirmSignIn,
  confirmSignUp,
  fetchAuthSession,
  signIn,
  signUp,
} from "aws-amplify/auth";

const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID?.trim();
const userPoolClientId =
  process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID?.trim();

let configured = false;

export class AuthConfigurationError extends Error {
  constructor() {
    super("로그인 설정이 아직 완료되지 않았어요. 관리자에게 문의해주세요.");
    this.name = "AuthConfigurationError";
  }
}

export class AuthRequiredError extends Error {
  constructor() {
    super("로그인이 필요해요.");
    this.name = "AuthRequiredError";
  }
}

export function configureAuth() {
  if (configured) return;
  if (!userPoolId || !userPoolClientId) return;

  Amplify.configure(
    {
      Auth: {
        Cognito: {
          userPoolId,
          userPoolClientId,
          loginWith: { email: true },
        },
      },
    },
    { ssr: true },
  );
  configured = true;
}

export function assertAuthConfigured() {
  configureAuth();
  if (!configured) throw new AuthConfigurationError();
}

export async function getAccessToken(): Promise<string> {
  assertAuthConfigured();
  let session: AuthSession;
  try {
    session = await fetchAuthSession();
  } catch {
    throw new AuthRequiredError();
  }
  const accessToken = session.tokens?.accessToken?.toString();

  if (!accessToken) throw new AuthRequiredError();
  return accessToken;
}

export async function signInWithPassword(username: string, password: string) {
  assertAuthConfigured();
  return signIn({ username, password });
}

export async function setNewPassword(password: string) {
  assertAuthConfigured();
  return confirmSignIn({ challengeResponse: password });
}

export async function createAccount(username: string, password: string) {
  assertAuthConfigured();
  return signUp({
    username,
    password,
    options: {
      userAttributes: { email: username },
    },
  });
}

export async function confirmAccount(username: string, confirmationCode: string) {
  assertAuthConfigured();
  return confirmSignUp({ username, confirmationCode });
}

configureAuth();
