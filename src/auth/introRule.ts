/** The intro plays once per account: until the account carries `praedus_intro_seen`. */
export function shouldPlayIntro(user: { user_metadata?: Record<string, unknown> } | null): boolean {
  return !!user && user.user_metadata?.praedus_intro_seen !== true
}
