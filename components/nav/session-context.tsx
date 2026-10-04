"use client";

import { createContext, useContext } from "react";

const SessionEmailContext = createContext<string | null>(null);

export function SessionEmailProvider({
  email,
  children
}: {
  email: string | null;
  children: React.ReactNode;
}) {
  return <SessionEmailContext.Provider value={email}>{children}</SessionEmailContext.Provider>;
}

export function useSessionEmail(): string | null {
  return useContext(SessionEmailContext);
}
