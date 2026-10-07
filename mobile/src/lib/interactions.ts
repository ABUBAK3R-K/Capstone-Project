import { supabase } from './supabase';

/** Mirrors the `interactions.interaction_type` check constraint. */
export type InteractionType = 'view' | 'favorite' | 'visit';

/**
 * Implicit feedback for the collaborative recommender, written straight to
 * Supabase. RLS (migration 007) is the boundary: a client can only insert
 * rows as `auth.uid()`, and the log is append-only. Going direct rather than
 * through the FastAPI service means feedback is still captured when the
 * recommendation service is down or not configured.
 */
export async function recordInteraction(
  userId: string,
  placeId: string,
  interactionType: InteractionType,
): Promise<void> {
  const { error } = await supabase
    .from('interactions')
    .insert({ user_id: userId, place_id: placeId, interaction_type: interactionType });
  if (error) throw error;
}

/** Fire-and-forget variant for passive signals (views) — must never block or surface. */
export function logInteraction(userId: string, placeId: string, interactionType: InteractionType = 'view'): void {
  void recordInteraction(userId, placeId, interactionType).catch(() => {
    // Analytics is best-effort by design.
  });
}

export interface PlaceMarks {
  saved: boolean;
  visited: boolean;
}

/**
 * Whether the signed-in user has already saved / marked-visited this place.
 * RLS only returns the caller's own interactions, so no user filter is
 * needed — but one is passed anyway so the query reads correctly.
 */
export async function fetchPlaceMarks(userId: string, placeId: string): Promise<PlaceMarks> {
  const { data, error } = await supabase
    .from('interactions')
    .select('interaction_type')
    .eq('user_id', userId)
    .eq('place_id', placeId)
    .in('interaction_type', ['favorite', 'visit']);

  if (error) throw error;
  const types = new Set((data ?? []).map((row) => row.interaction_type as InteractionType));
  return { saved: types.has('favorite'), visited: types.has('visit') };
}
