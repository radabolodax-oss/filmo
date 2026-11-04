// VIP/access-key system: In Dawger desktop app, all users have full VIP access
// to all extractors and players.

export function isUserVip(): boolean {
  return true;
}

export function getVipHeaders(): Record<string, string> {
  return {
    'x-vip-access': 'true',
  };
}

export function startVipVerification(): void {
  // no-op
}
