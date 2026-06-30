export interface User {
  id: string;
  email: string;
  full_name: string;
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
  phone?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Candidate {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Interview {
  id: string;
  job_id: string;
  candidate_id: string;
  candidate_name?: string;
  job_title?: string;
  company_name?: string;
  status: InterviewStatus;
  invite_token?: string;
  invited_at?: string;
  started_at?: string;
  completed_at?: string;
  video_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type InterviewStatus =
  | "invited"
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "expired";

export interface Question {
  id: string;
  interview_id: string;
  question_text: string;
  question_type: string;
  order: number;
  think_time_seconds: number;
  time_limit_seconds: number;
}

export interface Answer {
  id: string;
  interview_id: string;
  question_id: string;
  answer_text?: string;
  video_url?: string;
  transcript?: string;
  duration_seconds?: number;
  status: AnswerStatus;
  created_at: string;
}

export type AnswerStatus = "pending" | "uploading" | "uploaded" | "error";

export interface UploadProgress {
  questionId: string;
  progress: number;
  status: "pending" | "uploading" | "completed" | "error";
  error?: string;
}

export interface InterviewDetails {
  interview: Interview;
  questions: Question[];
}

export type RecordingState = "idle" | "recording" | "stopped" | "preview";
