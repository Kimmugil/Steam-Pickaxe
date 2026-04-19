export type GameStatus = "active" | "collecting" | "archived" | "error_pool_empty";

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
  peak_ccu: number;
  // 신규 메타 필드 (SteamSpy 필드 대체)
  genres?: string;
  developer?: string;
  publisher?: string;
  price?: string;
  metacritic_score: number | string;
  is_free: boolean | string;
  is_early_access: boolean | string;
  totalReviews: number;
  // 신규 필드
  release_date?: string;
  latest_sentiment_rate?: number | string;
  event_count?: number | string;
  game_sheet_id?: string;
  language_distribution?: string; // JSON: { language: reviewCount, ... } — RAW 리뷰 전체 기준
}

export interface TimelineRow {
  event_id: string;
  event_type: "official" | "news" | "manual" | "free_weekend" | "launch";
  date: string;
  title: string;
  title_kr?: string;   // AI 생성 한국어 제목
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
