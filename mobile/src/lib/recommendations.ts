import { env, hasRecommendationService } from './env';
import type { SimilarPlace } from '@/types/place';

const TIMEOUT_MS = 8_000;

export class RecommendationServiceError extends Error {
  constructor(readonly status: number) {
    super(`Recommendation service responded ${status}`);
    this.name = 'RecommendationServiceError';
  }
}

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
      throw new RecommendationServiceError(response.status);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GET /recommendations?place_id=…&limit=…
 *
 * A 404 means the place isn't in the service's similarity cache yet — it was
 * added (or its business approved) after the last rebuild. That's "no
 * similar places yet", not a failure worth an error state, so it resolves
 * empty. Interaction logging lives in lib/interactions.ts.
 */
export async function fetchSimilarPlaces(placeId: string, limit = 8): Promise<SimilarPlace[]> {
  if (!hasRecommendationService) return [];

  try {
    const data = await request<{ recommendations?: SimilarPlace[] }>(
      `/recommendations?place_id=${encodeURIComponent(placeId)}&limit=${limit}`,
    );
    return data.recommendations ?? [];
  } catch (error) {
    if (error instanceof RecommendationServiceError && error.status === 404) return [];
    throw error;
  }
}
