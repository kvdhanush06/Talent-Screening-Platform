import axios from "axios";
import type {
  AuthResponse,
  Candidate,
  CandidateDetail,
  CandidateScore,
  ComparisonResult,
  Interview,
  Job,
  JobAnalysis,
  JobCreate,
  JobUpdate,
  LoginRequest,
  Notification,
  Question,
  RegisterRequest,
  Scorecard,
  User,
  ApiResponse,
  Transcript,
} from "@/types";

const api = axios.create({
  baseURL: (import.meta as any).env?.VITE_API_URL || "http://localhost:8000/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    // If the backend wraps in {status, data}, extract the inner data
    if (response.data && typeof response.data === "object" && "status" in response.data) {
      return response;
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// Helper to unwrap backend's {status:"success", ...} wrapper
function unwrap<T>(response: { data: ApiResponse<T> | T }): T {
  const d = response.data;
  // If wrapped in {status, data} pattern, return the data field
  if (d && typeof d === "object" && "status" in d && "data" in d) {
    return (d as ApiResponse<T>).data as T;
  }
  return d as T;
}

// Special unwrap for auth which returns {access_token, token_type, user}
function unwrapAuth(response: { data: AuthResponse | ApiResponse<AuthResponse> }): AuthResponse {
  const d = response.data;
  if (d && typeof d === "object" && "access_token" in d) {
    return d as AuthResponse;
  }
  // Fallback for wrapped format
  if (d && typeof d === "object" && "status" in d && "data" in d) {
    const inner = (d as ApiResponse<AuthResponse>).data;
    if (inner && typeof inner === "object" && "access_token" in inner) {
      return inner as AuthResponse;
    }
  }
  return d as unknown as AuthResponse;
}

// ---- Auth ----
export const auth = {
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const resp = await api.post("/auth/login", data);
    return unwrapAuth(resp);
  },

  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const resp = await api.post("/auth/register", data);
    return unwrapAuth(resp);
  },

  getMe: async (): Promise<User> => {
    const resp = await api.get("/auth/me");
    const d = resp.data;
    if (d && typeof d === "object" && "status" in d && "user" in d) {
      return (d as Record<string, unknown>).user as User;
    }
    if (d && typeof d === "object" && "id" in d) {
      return d as User;
    }
    return d as unknown as User;
  },

  updateProfile: async (data: Partial<User>): Promise<User> => {
    const resp = await api.put("/auth/me", data);
    const d = resp.data;
    if (d && typeof d === "object" && "status" in d && "user" in d) {
      return (d as Record<string, unknown>).user as User;
    }
    return d as User;
  },
};

// ---- Jobs ----
export const jobs = {
  list: async (params?: Record<string, string>): Promise<Job[]> => {
    const resp = await api.get("/jobs", { params });
    const d = resp.data;
    if (d && typeof d === "object" && "status" in d && "jobs" in d) {
      return (d as Record<string, unknown>).jobs as Job[];
    }
    return Array.isArray(d) ? d : [];
  },

  get: async (id: string): Promise<Job> => {
    const resp = await api.get(`/jobs/${id}`);
    const d = resp.data;
    if (d && typeof d === "object" && "status" in d && "job" in d) {
      return (d as Record<string, unknown>).job as Job;
    }
    return d as Job;
  },

  create: async (data: JobCreate): Promise<Job> => {
    const resp = await api.post("/jobs", data);
    const d = resp.data;
    if (d && typeof d === "object" && "status" in d && "job" in d) {
      return (d as Record<string, unknown>).job as Job;
    }
    return d as Job;
  },

  update: async (id: string, data: JobUpdate): Promise<Job> => {
    const resp = await api.put(`/jobs/${id}`, data);
    const d = resp.data;
    if (d && typeof d === "object" && "status" in d && "job" in d) {
      return (d as Record<string, unknown>).job as Job;
    }
    return d as Job;
  },

  delete: (id: string) => api.delete(`/jobs/${id}`),

  analyze: async (id: string): Promise<JobAnalysis> => {
    const resp = await api.post(`/jobs/${id}/analyze`);
    const d = resp.data;
    if (d && typeof d === "object" && "status" in d && "analysis" in d) {
      return (d as Record<string, unknown>).analysis as JobAnalysis;
    }
    return d as JobAnalysis;
  },

  getAnalysis: async (id: string): Promise<JobAnalysis | null> => {
    const resp = await api.get(`/jobs/${id}/analysis`);
    const d = resp.data;
    if (d && typeof d === "object" && d.status === "pending") {
      return null;
    }
    if (d && typeof d === "object" && "status" in d && "analysis" in d) {
      return (d as Record<string, unknown>).analysis as JobAnalysis;
    }
    return d as JobAnalysis;
  },
};

// ---- Candidates ----
export const candidates = {
  list: async (params?: Record<string, string>): Promise<Candidate[]> => {
    // Support both /candidates list and /jobs/{job_id}/candidates
    const jobId = params?.job_id;
    let url = "/candidates";
    if (jobId) {
      url = `/jobs/${jobId}/candidates`;
    }
    const resp = await api.get(url);
    const d = resp.data;
    if (d && typeof d === "object" && "status" in d && "candidates" in d) {
      return (d as Record<string, unknown>).candidates as Candidate[];
    }
    return Array.isArray(d) ? d : [];
  },

  get: async (id: string): Promise<CandidateDetail> => {
    const resp = await api.get(`/candidates/${id}`);
    const d = resp.data;
    if (d && typeof d === "object" && "status" in d) {
      return {
        ...(d as Record<string, unknown>).candidate as Candidate,
        scores: (d as Record<string, unknown>).scores as CandidateScore | undefined,
      } as CandidateDetail;
    }
    return d as CandidateDetail;
  },

  search: async (jobId: string): Promise<Candidate[]> => {
    const resp = await api.post("/candidates/search", { job_id: jobId });
    const d = resp.data;
    if (d && typeof d === "object" && "status" in d && "candidates" in d) {
      return (d as Record<string, unknown>).candidates as Candidate[];
    }
    return Array.isArray(d) ? d : [];
  },

  evaluate: async (id: string): Promise<CandidateScore> => {
    const resp = await api.post(`/candidates/${id}/evaluate`);
    const d = resp.data;
    if (d && typeof d === "object" && "status" in d && "evaluation" in d) {
      return (d as Record<string, unknown>).evaluation as CandidateScore;
    }
    return d as CandidateScore;
  },

  evaluateAll: async (jobId: string): Promise<CandidateScore[]> => {
    const resp = await api.post(`/candidates/evaluate-all/${jobId}`);
    const d = resp.data;
    return Array.isArray(d) ? d : [];
  },

  shortlist: async (id: string, value: boolean, reason?: string): Promise<Candidate> => {
    const resp = await api.put(`/candidates/${id}/shortlist`, {
      is_shortlisted: value,
      shortlist_reason: reason || "",
    });
    const d = resp.data;
    if (d && typeof d === "object" && "status" in d && "candidate" in d) {
      return (d as Record<string, unknown>).candidate as Candidate;
    }
    return d as Candidate;
  },
};

// ---- Interviews ----
export const interviews = {
  create: async (data: { job_id: string; candidate_id: string }): Promise<Interview> => {
    const resp = await api.post("/interviews", data);
    const d = resp.data;
    if (d && typeof d === "object" && "status" in d && "interview" in d) {
      return (d as Record<string, unknown>).interview as Interview;
    }
    return d as Interview;
  },

  list: async (params?: Record<string, string>): Promise<Interview[]> => {
    const resp = await api.get("/interviews", { params });
    const d = resp.data;
    if (d && typeof d === "object" && "status" in d && "interviews" in d) {
      return (d as Record<string, unknown>).interviews as Interview[];
    }
    return Array.isArray(d) ? d : [];
  },

  get: async (id: string): Promise<Interview> => {
    const resp = await api.get(`/interviews/${id}`);
    const d = resp.data;
    if (d && typeof d === "object" && "status" in d && "interview" in d) {
      return (d as Record<string, unknown>).interview as Interview;
    }
    return d as Interview;
  },

  updateStatus: async (id: string, status: string): Promise<Interview> => {
    const resp = await api.put(`/interviews/${id}/status`, { status });
    const d = resp.data;
    if (d && typeof d === "object" && "status" in d && "interview" in d) {
      return (d as Record<string, unknown>).interview as Interview;
    }
    return d as Interview;
  },

  generateQuestions: async (id: string): Promise<Question[]> => {
    const resp = await api.post(`/interviews/${id}/questions`);
    const d = resp.data;
    if (d && typeof d === "object" && "status" in d && "questions" in d) {
      return (d as Record<string, unknown>).questions as Question[];
    }
    return Array.isArray(d) ? d : [];
  },

  submitAnswer: async (id: string, data: { question_id: string; answer_text: string }): Promise<void> => {
    await api.post(`/interviews/${id}/answers`, data);
  },

  getQuestions: async (id: string): Promise<Question[]> => {
    const resp = await api.get(`/interviews/${id}`);
    const d = resp.data;
    if (d && typeof d === "object" && "status" in d && "questions" in d) {
      return (d as Record<string, unknown>).questions as Question[];
    }
    return [];
  },

  complete: async (id: string): Promise<Scorecard> => {
    const resp = await api.post(`/interviews/${id}/complete`);
    const d = resp.data;
    if (d && typeof d === "object" && "status" in d && "scorecard" in d) {
      return (d as Record<string, unknown>).scorecard as Scorecard;
    }
    return d as Scorecard;
  },

  getScorecard: async (id: string): Promise<Scorecard | null> => {
    const resp = await api.get(`/interviews/${id}/scorecard`);
    const d = resp.data;
    if (d && typeof d === "object" && "status" in d) {
      return (d as Record<string, unknown>).scorecard as Scorecard || null;
    }
    return d as Scorecard;
  },

  getTranscript: async (id: string): Promise<Transcript[]> => {
    const resp = await api.get(`/interviews/${id}/transcript`);
    const d = resp.data;
    if (d && typeof d === "object" && "status" in d && "transcripts" in d) {
      return (d as Record<string, unknown>).transcripts as Transcript[];
    }
    return Array.isArray(d) ? d : [];
  },

  sendInvitation: async (id: string): Promise<boolean> => {
    const resp = await api.post(`/interviews/${id}/send-invitation`);
    const d = resp.data;
    if (d && typeof d === "object" && "email_sent" in d) {
      return (d as Record<string, unknown>).email_sent as boolean;
    }
    return false;
  },
};

// ---- Notifications ----
export const notifications = {
  list: async (): Promise<Notification[]> => {
    const resp = await api.get("/notifications");
    const d = resp.data;
    if (d && typeof d === "object" && "status" in d && "notifications" in d) {
      return (d as Record<string, unknown>).notifications as Notification[];
    }
    return Array.isArray(d) ? d : [];
  },

  markRead: (id: string) => api.put(`/notifications/${id}/read`),

  markAllRead: () => api.put("/notifications/read-all"),
};

// ---- Compare ----
export const compare = {
  compareCandidates: async (jobId: string, candidateIds: string[]): Promise<ComparisonResult> => {
    const resp = await api.post(`/jobs/${jobId}/compare`, { candidate_ids: candidateIds });
    const d = resp.data;
    if (d && typeof d === "object" && "status" in d && "comparison" in d) {
      return (d as Record<string, unknown>).comparison as ComparisonResult;
    }
    return d as ComparisonResult;
  },
};

export default api;
