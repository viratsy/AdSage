export interface Ad {
  ad_id: string;
  advertiser_name: string;
  primary_text?: string;
  headline?: string;
  image_urls?: string[];
  video_urls?: string[];
  favorite?: boolean;
  ai_analysis_status?: string;
  created_at: string;
  tags?: string[];
  cta?: string;
  notes?: string;
  landing_page?: string;
  platform?: string;
  video_transcript?: string;
}

export interface AiAnalysis {
  analysis_id: string;
  ad_id: string;
  hook_type?: string;
  emotional_trigger?: string;
  audience_type?: string;
  funnel_stage?: string;
  cta_strength?: string;
  ai_score?: number;
  generated_hooks?: string[];
  generated_ctas?: string[];
  short_copy?: string;
  long_copy?: string;
  image_prompt?: string;
  ad_analysis?: string;
  business_profile_used?: boolean;
}

export interface BillingStatus {
  subscription_plan: 'free' | 'pro';
  ai_credits: number;
  ads_saved_count: number;
}
