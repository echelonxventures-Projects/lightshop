const MESSAGES: Record<string, string> = {
  'other-store': 'This account belongs to a different store. Sign in with an account for this store.',
  state: 'Your sign-in session expired. Please try again.',
  denied: 'Sign-in was cancelled.',
  failed: 'Sign-in failed. Please try again.',
};

export default async function AuthError({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  return (
    <div className="sf-empty">
      <h1>Couldn&apos;t sign you in</h1>
      <p data-testid="auth-error">{MESSAGES[reason ?? ''] ?? MESSAGES.failed}</p>
      <p><a href="/auth/login">Try again</a></p>
    </div>
  );
}
