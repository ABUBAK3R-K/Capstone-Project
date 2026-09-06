/** Shape returned by the `nearby_places` and `search_places` RPCs. */
export interface Place {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  description: string | null;
  lat: number;
  lng: number;
  address: string | null;
  images: string[] | null;
  source: string | null;
  created_by?: string | null;
  created_at?: string | null;
}

/** A place plus its cosine similarity, from GET /recommendations. */
export interface SimilarPlace extends Omit<Place, 'id' | 'source'> {
  place_id: string;
  similarity_score: number;
}

export type ReportStatus = 'reported' | 'in_progress' | 'fixed';

export interface ProblemReport {
  id: string;
  category: string | null;
  description: string | null;
  photo_url: string | null;
  status: ReportStatus;
  created_at: string;
  resolved_at: string | null;
  lat: number | null;
  lng: number | null;
}
