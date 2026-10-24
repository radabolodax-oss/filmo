// Account/login system removed. Kept as a permanent no-op stub so unrelated
// call sites (Settings account-linking section, wrapped tracker, App.tsx
// auth-change listeners) don't need per-callsite surgery — every consumer
// already null/falsy-checks these fields before doing anything, so this
// safely resolves to "no account, ever".

export interface ResolvedAccountContext {
  userType: 'oauth' | 'bip39' | null;
  userId: string | null;
  accountProvider: string | null;
  authMethod: string | null;
  manageWithProvider: string | null;
}

export function getResolvedAccountContext(): ResolvedAccountContext {
  return {
    userType: null,
    userId: null,
    accountProvider: null,
    authMethod: null,
    manageWithProvider: null,
  };
}

export function getResolvedUserId(): string | null {
  return null;
}

export function clearStoredAuthSession(): void {
  // no-op
}

export function broadcastAuthChange(): void {
  // no-op
}

export function setPendingAuthLink(_provider: string, _returnTo: string): void {
  // no-op
}

export function getPendingAuthAction(): null {
  return null;
}

export function clearPendingAuthAction(): void {
  // no-op
}

export function persistResolvedSession(): void {
  // no-op
}
