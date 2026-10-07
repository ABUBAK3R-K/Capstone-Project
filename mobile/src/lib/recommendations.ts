import { env, hasRecommendationService } from './env';
import { supabase } from './supabase';
import type { SimilarPlace } from '@/types/place';

const TIMEOUT_MS = 8_000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${env.recommendationsUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });

    if (!response.ok) {
      throw new Error(`Recommendation service responded ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** GET /recommendations?place_id=…&limit=… */
export async function fetchSimilarPlaces(placeId: string, limit = 8): Promise<SimilarPlace[]> {
  if (!hasRecommendationService) return [];

  const data = await request<{ recommendations?: SimilarPlace[] }>(
    `/recommendations?place_id=${encodeURIComponent(placeId)}&limit=${limit}`,
  );
  return data.recommendations ?? [];
}

/** Mirrors the `interactions.interaction_type` check constraint. */
export type InteractionType = 'view' | 'favorite' | 'visit';

async function postInteraction(placeId: string, interactionType: InteractionType): Promise<void> {
  // The service derives user_id from this token rather than trusting the
  // request body. Read at call time, not passed in, so an hourly token refresh
  // never re-triggers a caller's effect and double-logs a view.
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) return;

  await request('/interactions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ place_id: placeId, interaction_type: interactionType }),
  });
}

/**
 * POST /interactions — fire-and-forget logging that feeds the similarity
 * model. A failure here must never surface to the user or block the screen.
 * A no-op without a signed-in session (e.g. under DEV_SKIP_AUTH).
 */
export function logInteraction(placeId: string, interactionType: InteractionType = 'view'): void {
  if (!hasRecommendationService) return;

  void postInteraction(placeId, interactionType).catch(() => {
    // Analytics is best-effort by design.
  });
}
