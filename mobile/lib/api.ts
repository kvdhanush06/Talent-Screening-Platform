import axios, { AxiosError } from "axios";
import config from "./config";
import storage from "./storage";
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  User,
  Interview,
  InterviewDetails,
  Question,
  Answer,
} from "./types";

const api = axios.create({
  baseURL: config.API_BASE_URL,
  timeout: config.API_TIMEOUT,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  async (reqConfig) => {
    const token = await storage.getToken();
    if (token) {
      reqConfig.headers.Authorization = `Bearer ${token}`;
    }
    return reqConfig;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      await storage.clearAll();
    }
    return Promise.reject(error);
  }
);

function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    if (error.response?.data && typeof error.response.data === "object") {
      const data = error.response.data as Record<string, unknown>;
      if (typeof data.detail === "string") return data.detail;
      if (typeof data.message === "string") return data.message;
    }
    if (error.code === "ERR_NETWORK") {
      return "Unable to connect to the server. Please check your internet connection.";
    }
    return error.message || "An unexpected error occurred";
  }
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred";
}

// ---- Auth ----
export const authApi = {
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>("/auth/login", data);
    return response.data;
  },

  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>("/auth/register", data);
    return response.data;
  },

  getMe: async (): Promise<User> => {
    const response = await api.get<User>("/auth/me");
    return response.data;
  },

  updateProfile: async (data: Partial<User>): Promise<User> => {
    const response = await api.put<User>("/auth/profile", data);
    return response.data;
  },
};

// ---- Interviews (candidate-facing token-based flow) ----
export const interviewApi = {
  getPendingInterviews: async (): Promise<Interview[]> => {
    // Return empty list as candidates only log in via token deep link
    return [];
  },

  getInterviewDetails: async (token: string): Promise<InterviewDetails> => {
    const response = await api.get<InterviewDetails>(`/interviews/candidate/${token}`);
    return response.data;
  },

  getQuestions: async (token: string): Promise<Question[]> => {
    const response = await api.get<{ questions: Question[] }>(`/interviews/candidate/${token}`);
    return response.data?.questions || [];
  },

  startInterview: async (token: string): Promise<Interview> => {
    const response = await api.post<any>(`/interviews/candidate/${token}/start`);
    return response.data?.interview;
  },

  submitAnswer: async (
    token: string,
    questionId: string,
    videoUri: string
  ): Promise<Answer> => {
    const formData = new FormData();
    const filename = videoUri.split("/").pop() || "video.mp4";
    const mimeType = filename.endsWith(".mp4") ? "video/mp4" : "video/quicktime";

    formData.append("video", {
      uri: videoUri,
      name: filename,
      type: mimeType,
    } as unknown as Blob);
    formData.append("question_id", questionId);

    const response = await api.post<any>(
      `/interviews/candidate/${token}/answers`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
      }
    );
    return response.data?.answer;
  },

  completeInterview: async (token: string): Promise<Interview> => {
    const response = await api.post<any>(`/interviews/candidate/${token}/complete`);
    return response.data?.interview;
  },

  getCandidateProfile: async (): Promise<User> => {
    const response = await api.get<User>("/candidates/me");
    return response.data;
  },

  updateCandidateProfile: async (data: Partial<User>): Promise<User> => {
    const response = await api.put<User>("/candidates/me", data);
    return response.data;
  },
};

export { getErrorMessage };
export default api;
