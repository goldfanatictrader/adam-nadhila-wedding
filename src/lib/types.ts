export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  AI?: Ai;
  EMAIL?: {
    send(message: {
      to: string;
      from: string;
      subject: string;
      text: string;
      html?: string;
    }): Promise<unknown>;
  };
  APP_ENV: 'local' | 'staging' | 'production';
  PUBLIC_SITE_URL: string;
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  GUEST_ENCRYPTION_KEY: string;
  RATE_LIMIT_SECRET: string;
  TURNSTILE_SECRET_KEY?: string;
  PUBLIC_TURNSTILE_SITE_KEY?: string;
  EMAIL_FROM: string;
  AI_ENABLED: string;
  AI_DAILY_BUDGET_MICRO_USD: string;
}
export type Actor = {
  id: string;
  email: string;
  name: string;
  verified: boolean;
  admin: boolean;
  mfa: boolean;
  sessionId: string;
};
export type EventRow = {
  id: string;
  tenant_id: string;
  owner_id: string;
  slug: string;
  title: string;
  status: 'draft' | 'published' | 'suspended' | 'deleted';
  template_id: string;
  template_version: number;
  draft: string;
  published: string | null;
  version: number;
  published_version: number | null;
  plan: string | null;
  plan_snapshot: string | null;
  paid_at: number | null;
  activated_at: number | null;
  expires_at: number | null;
  duration_months: number;
  ai_used: number;
  ai_reserved: number;
  ai_credits: number;
  media_limit: number;
  photo_limit: number;
  guest_limit: number;
  trial_expires_at: number;
  created_at: number;
  responses_open: number;
  deleted_at: number | null;
};
