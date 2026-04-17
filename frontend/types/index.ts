export type GameStatus = "active" | "collecting" | "archived";

export interface Game {
  appid: string;
  name: string;
  name_kr: string;
  thumbnail: string;
  status: GameStatus;
  collection_started_at: string;
  last_cursor: string;
  total_reviews_count: number;
  collected_reviews_count: number;
  last_event_date: string;
  top_languages: string;
  ai_briefing: string;
  ai_briefing_date: string;
  owners_estimate: number;
  avg_playtime: number;
  median_playtime: number;
  active_players_2weeks: number;
  peak_ccu: number;
  metacritic_score: number | string;
  is_free: boolean;
  is_early_access: boolean;
  totalReviews: number;
}

export interface TimelineRow {
  event_id: string;
  event_type: "official" | "news" | "manual" | "free_weekend" | "launch";
  date: string;
  title: string;
  language_scope: string;
  sentiment_rate: number | string;
  review_count: number | string;
  ai_patch_summary: string;
  ai_reaction_summary: string;
  top_keywords: string;
  top_reviews: string;
  url: string;
  is_sale_period: boolean | string;
  sale_text: string;
  is_free_weekend: boolean | string;
}

export interface CcuRow {
  timestamp: string;
  ccu_value: number | string;
  is_sale_period: boolean | string;
  is_free_weekend: boolean | string;
  is_archived_gap: boolean | string;
}

export interface ConfigMap {
  [key: string]: string;
}

export interface SteamSearchResult {
  appid: string;
  name: string;
  thumbnail: string;
  type: string;
  totalReviews?: number;
  positiveRate?: number;
  /** Steam appdetails 추가 메타데이터 */
  release_date?: string;
  developers?: string[];
  publishers?: string[];
}

export interface TopReview {
  text: string;
  text_kr: string;
  voted_up: boolean;
  language: string;
}
