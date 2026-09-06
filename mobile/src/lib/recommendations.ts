import { env, hasRecommendationService } from './env';
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

/**
 * POST /interactions — fire-and-forget view logging that feeds the similarity
 * model. A failure here must never surface to the user or block the screen.
 */
export function logInteraction(
  userId: string | null | undefined,
  placeId: string,
  interactionType: 'view' | 'favorite' | 'share' = 'view',
): void {
  if (!hasRecommendationService || !userId) return;

  void request('/interactions', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, place_id: placeId, interaction_type: interactionType }),
  }).catch(() => {
    // Analytics is best-effort by design.
  });
}
