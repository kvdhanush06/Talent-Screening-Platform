// ---- API Response Wrapper ----
export interface ApiResponse<T> {
  status: "success" | "error" | "pending";
  data?: T;
  message?: string;
}

// ---- Auth ----
export interface User {
  id: string;
  email: string;
  full_name: string;
  company_name?: string;
  role?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  company_name?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

// ---- Jobs ----
export interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  employment_type: string;
  experience_level: string;
  description: string;
  status: string;
  user_id?: string;
  created_at: string;
  updated_at: string;
}

export interface JobCreate {
  title: string;
  department?: string;
  location?: string;
  employment_type?: string;
  experience_level?: string;
  description: string;
}

export interface JobUpdate {
  title?: string;
  department?: string;
  location?: string;
  employment_type?: string;
  experience_level?: string;
  description?: string;
  status?: string;
}

export interface ImplicitRequirement {
  signal: string;
  interpretation: string;
  relevance: "high" | "medium" | "low";
}

export interface JobAnalysis {
  job_id: string;
  required_skills: string[];
  preferred_skills: string[];
  experience_required: { years: number; level: string };
  education_required: string;
  key_responsibilities: string[];
  soft_skills: string[];
  implicit_requirements?: ImplicitRequirement[];
  role_level?: string;
  seniority_indicators?: string[];
  domain_experience?: string[];
  created_at: string;
}

export interface CandidateRedFlag {
  type: string;
  severity: "high" | "medium" | "low";
  detail: string;
}

// ---- Candidates ----
export interface Experience {
  title: string;
  company: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  current?: boolean;
  description?: string;
  years?: number;
}

export interface Education {
  degree: string;
  institution?: string;
  school?: string;
  field?: string;
  start_date?: string;
  end_date?: string;
}

export interface Candidate {
  id: string;
  job_id: string;
  name: string;
  email: string;
  phone?: string;
  location?: string;
  current_title?: string;
  current_company?: string;
  summary?: string;
  skills: string[];
  experience: Experience[];
  education: Education[];
  profile_url?: string;
  match_score?: number;
  status: string;
  is_shortlisted: boolean;
  shortlist_reason?: string;
  confidence_level?: string;
  red_flags?: CandidateRedFlag[];
  source?: string;
  created_at: string;
  updated_at: string;
}

export interface CandidateScore {
  skills_score: number;
  experience_score: number;
  education_score: number;
  seniority_score: number;
  domain_score: number;
  cultural_fit_score: number;
  overall_score: number;
  recommendation: string;
  strengths: string[];
  concerns: string[];
  red_flags?: CandidateRedFlag[];
  is_shortlisted?: boolean;
  shortlist_reason?: string;
  scoring_method?: string;
  ai_evaluation?: {
    summary?: string;
    semantic_matches?: string[];
    missing_or_weak?: string[];
  };
  evaluated_at?: string;
}

export interface CandidateDetail extends Candidate {
  scores?: CandidateScore;
}

// ---- Interviews ----
export interface Interview {
  id: string;
  job_id: string;
  candidate_id: string;
  candidate_name?: string;
  job_title?: string;
  company_name?: string;
  status: string;
  invite_token?: string;
  invited_at?: string;
  started_at?: string;
  completed_at?: string;
  current_question?: number;
  total_questions?: number;
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: string;
  interview_id: string;
  question_text: string;
  question_type: string;
  order: number;
  think_time_seconds?: number;
  time_limit_seconds?: number;
  created_at?: string;
}

export interface Answer {
  id: string;
  interview_id: string;
  question_id: string;
  video_url?: string;
  duration_seconds?: number;
  status: string;
  created_at: string;
}

export interface Transcript {
  id?: string;
  answer_id?: string;
  interview_id: string;
  text: string;
  language?: string;
  segments?: Array<{ start: number; end: number; text: string }>;
  word_count?: number;
  filler_word_count?: number;
  confidence_score?: number;
  created_at?: string;
}

export interface Scorecard {
  id: string;
  interview_id: string;
  candidate_id?: string;
  job_id?: string;
  overall_score: number;
  relevance_score?: number;
  clarity_score?: number;
  specificity_score?: number;
  depth_score?: number;
  communication_score: number;
  technical_score?: number;
  problem_solving_score?: number;
  cultural_fit_score?: number;
  recommendation: string;
  confidence?: string;
  strengths: string[];
  weaknesses: string[];
  per_question_scores?: Record<string, unknown>[];
  follow_up_questions?: string[];
  summary?: string;
  raw_evaluation?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

// ---- Notifications ----
export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

// ---- Comparison ----
export interface ComparisonResult {
  summary: {
    job_title: string;
    total_compared: number;
    highest_scored: string | null;
    recommendation?: string;
  };
  candidates: CandidateComparison[];
}

export interface CandidateComparison {
  candidate: Candidate;
  scores: CandidateScore | Record<string, unknown>;
}
