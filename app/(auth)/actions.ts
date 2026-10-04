"use server";

import { redirect } from "next/navigation";

import { publicEnv, serverEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type ResetPasswordInput,
  type SignupInput,
} from "@/lib/validation/auth";

export type AuthActionResult = {
  error?: string;
  success?: string;
};

function authUrl(): string {
  // Prefer the request origin when available; fall back to configured app URL.
  return serverEnv().nodeEnv === "test" ? "http://localhost:3000" : publicEnv().appUrl;
}

function friendlyAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return "Incorrect email or password.";
  }
  if (lower.includes("email not confirmed")) {
    return "Please confirm your email address first (check your inbox).";
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  if (lower.includes("already registered") || lower.includes("already exists")) {
    return "An account with this email already exists. Try logging in.";
  }
  if (lower.includes("password")) {
    return "Please choose a stronger password (min 8 characters).";
  }
  return "Something went wrong. Please try again.";
}

export async function signupAction(
  values: SignupInput,
): Promise<AuthActionResult> {
  const parsed = signupSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${authUrl()}/auth/confirm`,
    },
  });

  if (error) {
    return { error: friendlyAuthError(error.message) };
  }

  // If email confirmation is disabled, signUp returns a session directly.
  if (data.session) {
    redirect("/app/dashboard");
  }

  return {
    success:
      "Account created. Check your email to verify your address, then log in.",
  };
}

export async function loginAction(
  values: LoginInput,
): Promise<AuthActionResult> {
  const parsed = loginSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: friendlyAuthError(error.message) };
  }

  redirect("/app/dashboard");
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function forgotPasswordAction(
  values: ForgotPasswordInput,
): Promise<AuthActionResult> {
  const parsed = forgotPasswordSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${authUrl()}/auth/confirm?type=recovery`,
  });

  if (error) {
    return { error: friendlyAuthError(error.message) };
  }

  return {
    success: "If that email is registered, a password reset link is on its way.",
  };
}

export async function resetPasswordAction(
  values: ResetPasswordInput,
): Promise<AuthActionResult> {
  const parsed = resetPasswordSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { error: friendlyAuthError(error.message) };
  }

  redirect("/app/dashboard");
}
