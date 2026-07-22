// VIP/access-key system removed (account + payment + access-key VIP all gone).
// Kept as a permanent no-op stub so unrelated features that call these
// (Debrid headers, comments, wishboard/link-submission requests) don't need
// per-callsite surgery — they just always see "not VIP" now.

export function isUserVip(): boolean {
  return false;
}

export function getVipHeaders(): Record<string, string> {
  return {};
}

export function startVipVerification(): void {
  // no-op
}
