import { interviewApi } from "@/lib/api";
import { uploadSingleVideo } from "./uploadService";
import type {
  Interview,
  InterviewDetails,
  Question,
  Answer,
} from "@/lib/types";

interface AnswerRecord {
  questionId: string;
  videoUri: string;
  status: "pending" | "uploaded" | "error";
  error?: string;
}

class InterviewService {
  private questionsCache: Map<string, Question[]> = new Map();
  private answersStore: Map<string, Map<string, string>> = new Map();

  setQuestions(interviewId: string, questions: Question[]): void {
    this.questionsCache.set(interviewId, questions);
  }

  getQuestions(interviewId: string): Question[] {
    return this.questionsCache.get(interviewId) || [];
  }

  clearQuestions(interviewId: string): void {
    this.questionsCache.delete(interviewId);
  }

  storeVideoUri(interviewId: string, questionId: string, uri: string): void {
    if (!this.answersStore.has(interviewId)) {
      this.answersStore.set(interviewId, new Map());
    }
    this.answersStore.get(interviewId)!.set(questionId, uri);
  }

  getStoredVideoUri(interviewId: string, questionId: string): string | null {
    return this.answersStore.get(interviewId)?.get(questionId) || null;
  }

  getAllStoredVideos(interviewId: string): Map<string, string> {
    return this.answersStore.get(interviewId) || new Map();
  }

  clearStoredVideos(interviewId: string): void {
    this.answersStore.delete(interviewId);
  }

  async fetchPendingInterviews(): Promise<Interview[]> {
    return interviewApi.getPendingInterviews();
  }

  async fetchInterviewDetails(id: string): Promise<InterviewDetails> {
    const details = await interviewApi.getInterviewDetails(id);
    this.setQuestions(id, details.questions);
    return details;
  }

  async startInterview(id: string): Promise<Interview> {
    return interviewApi.startInterview(id);
  }

  async uploadAnswer(
    interviewId: string,
    questionId: string,
    videoUri: string,
    onProgress?: (progress: number) => void
  ): Promise<AnswerRecord> {
    const result = await uploadSingleVideo({
      interviewId,
      questionId,
      videoUri,
      onProgress,
    });

    if (result.success) {
      return { questionId, videoUri, status: "uploaded" };
    }
    return {
      questionId,
      videoUri,
      status: "error",
      error: result.error,
    };
  }

  async completeInterview(id: string): Promise<Interview> {
    const result = await interviewApi.completeInterview(id);
    this.clearQuestions(id);
    this.clearStoredVideos(id);
    return result;
  }

  getNextQuestion(
    interviewId: string,
    currentQuestionId: string
  ): Question | null {
    const questions = this.getQuestions(interviewId);
    const currentIndex = questions.findIndex(
      (q) => q.id === currentQuestionId
    );
    if (currentIndex === -1 || currentIndex >= questions.length - 1) {
      return null;
    }
    return questions[currentIndex + 1];
  }

  getFirstQuestion(interviewId: string): Question | null {
    const questions = this.getQuestions(interviewId);
    return questions.length > 0 ? questions[0] : null;
  }

  getQuestionCount(interviewId: string): number {
    return this.getQuestions(interviewId).length;
  }

  getQuestionIndex(interviewId: string, questionId: string): number {
    const questions = this.getQuestions(interviewId);
    return questions.findIndex((q) => q.id === questionId);
  }

  getQuestionById(interviewId: string, questionId: string): Question | null {
    const questions = this.getQuestions(interviewId);
    return questions.find((q) => q.id === questionId) || null;
  }
}

export const interviewService = new InterviewService();
export default interviewService;
