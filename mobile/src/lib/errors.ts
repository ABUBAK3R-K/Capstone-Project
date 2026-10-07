/**
 * A user-presentable message from anything thrown. Supabase errors are not
 * always `Error` instances (PostgREST errors can arrive as plain objects with
 * a `message`), so `instanceof Error` alone would hide the real reason.
 */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const { message } = error as { message: unknown };
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}
