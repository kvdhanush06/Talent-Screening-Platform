import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { interviews as interviewsApi } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/ui/loading";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/toast";
import { formatDateFull } from "@/lib/utils";
import {
  ArrowLeft,
  Video,
  MessageSquare,
  ClipboardList,
  CheckCircle,
  Loader2,
  ThumbsUp,
  AlertTriangle,
  FileText,
} from "lucide-react";
import type { Scorecard, Question } from "@/types";

export default function InterviewDetail() {
  const { id } = useParams<{ id: string }>();
  const interviewId = id || "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"questions" | "scorecard" | "transcript">("questions");

  const { data: interview, isLoading } = useQuery({
    queryKey: ["interview", interviewId],
    queryFn: () => interviewsApi.get(interviewId),
    enabled: !!interviewId,
  });

  const { data: scorecard, isLoading: scorecardLoading } = useQuery({
    queryKey: ["scorecard", interviewId],
    queryFn: () => interviewsApi.getScorecard(interviewId),
    enabled: !!interviewId,
  });

  const generateQuestionsMutation = useMutation({
    mutationFn: () => interviewsApi.generateQuestions(interviewId),
    onSuccess: () => {
      toast("success", "Questions Generated", "Interview questions have been generated.");
    },
    onError: () => {
      toast("error", "Generation Failed", "Could not generate questions.");
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => interviewsApi.complete(interviewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interview", interviewId] });
      queryClient.invalidateQueries({ queryKey: ["scorecard", interviewId] });
      toast("success", "Interview Completed", "Scorecard has been generated.");
    },
    onError: () => {
      toast("error", "Failed to Complete", "Could not complete the interview.");
    },
  });

  if (isLoading) return <Loading text="Loading interview details..." />;
  if (!interview)
    return <div className="text-center py-16 text-gray-500">Interview not found</div>;

  const getStatusVariant = (status: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      scheduled: "outline",
      in_progress: "default",
      completed: "secondary",
      cancelled: "destructive",
    };
    return map[status] || "secondary";
  };

  const scoreBarColor = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate("/interviews")}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Interviews
      </button>

      {/* Interview Info */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <CardTitle className="text-xl">
                  {interview.candidate_name || `Candidate #${interview.candidate_id}`}
                </CardTitle>
                <Badge variant={getStatusVariant(interview.status)}>
                  {interview.status.replace("_", " ")}
                </Badge>
              </div>
              <CardDescription className="mt-1">
                {interview.job_title || `Job #${interview.job_id}`}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {interview.status !== "completed" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => generateQuestionsMutation.mutate()}
                    disabled={generateQuestionsMutation.isPending}
                  >
                    {generateQuestionsMutation.isPending ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="mr-1 h-4 w-4" />
                    )}
                    Generate Questions
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => completeMutation.mutate()}
                    disabled={completeMutation.isPending}
                  >
                    {completeMutation.isPending ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="mr-1 h-4 w-4" />
                    )}
                    Complete
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            {interview.invited_at && (
              <div className="flex items-center gap-1.5">
                <span className="font-medium">Scheduled:</span>
                {formatDateFull(interview.invited_at)}
              </div>
            )}
            {interview.completed_at && (
              <div className="flex items-center gap-1.5">
                <span className="font-medium">Completed:</span>
                {formatDateFull(interview.completed_at)}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { id: "questions", label: "Questions", icon: MessageSquare },
          { id: "scorecard", label: "Scorecard", icon: ClipboardList },
          { id: "transcript", label: "Transcript", icon: FileText },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === tab.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Questions Tab */}
      {activeTab === "questions" && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-600" />
              <CardTitle>Interview Questions</CardTitle>
            </div>
            <CardDescription>
              Questions for this interview session
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-400">
              <MessageSquare className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p>Questions will appear here once generated.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => generateQuestionsMutation.mutate()}
                disabled={generateQuestionsMutation.isPending}
              >
                {generateQuestionsMutation.isPending ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="mr-1 h-4 w-4" />
                )}
                Generate Questions
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scorecard Tab */}
      {activeTab === "scorecard" && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-blue-600" />
              <CardTitle>Scorecard</CardTitle>
            </div>
            <CardDescription>
              AI-generated evaluation of the interview
            </CardDescription>
          </CardHeader>
          <CardContent>
            {scorecardLoading ? (
              <Loading size="sm" />
            ) : !scorecard ? (
              <div className="text-center py-8 text-gray-400">
                <ClipboardList className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                <p>Complete the interview to generate a scorecard.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Overall Score */}
                <div className="text-center">
                  <div
                    className={`inline-flex items-center justify-center h-24 w-24 rounded-full text-3xl font-bold ${
                      scorecard.overall_score >= 80
                        ? "bg-green-100 text-green-700"
                        : scorecard.overall_score >= 60
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {scorecard.overall_score}
                  </div>
                  <p className="text-sm text-gray-500 mt-2">Overall Score</p>
                </div>

                {/* Category Scores */}
                <div className="space-y-4">
                  {[
                    { label: "Communication", value: scorecard.communication_score },
                    { label: "Technical", value: scorecard.technical_score },
                    { label: "Problem Solving", value: scorecard.problem_solving_score },
                    { label: "Cultural Fit", value: scorecard.cultural_fit_score },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">{item.label}</span>
                        <span className="font-medium">{item.value}</span>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${scoreBarColor(item.value || 0)}`}
                          style={{ width: `${item.value || 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Strengths */}
                {scorecard.strengths?.length > 0 && (
                  <>
                    <h4 className="text-sm font-semibold text-green-700 flex items-center gap-1">
                      <ThumbsUp className="h-4 w-4" /> Strengths
                    </h4>
                    <ul className="space-y-1">
                      {scorecard.strengths.map((s, i) => (
                        <li key={i} className="text-sm text-gray-600 flex items-start gap-1.5">
                          <span className="text-green-500 mt-0.5">&#x2022;</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {/* Weaknesses */}
                {scorecard.weaknesses?.length > 0 && (
                  <>
                    <Separator />
                    <h4 className="text-sm font-semibold text-red-700 flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4" /> Areas for Improvement
                    </h4>
                    <ul className="space-y-1">
                      {scorecard.weaknesses.map((w, i) => (
                        <li key={i} className="text-sm text-gray-600 flex items-start gap-1.5">
                          <span className="text-red-500 mt-0.5">&#x2022;</span>
                          {w}
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {scorecard.recommendation && (
                  <>
                    <Separator />
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center">
                      <p className="text-sm font-medium text-blue-800">
                        Recommendation: {scorecard.recommendation.replace(/_/g, " ")}
                      </p>
                    </div>
                  </>
                )}

                {scorecard.summary && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">Summary</h4>
                      <p className="text-sm text-gray-600">{scorecard.summary}</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Transcript Tab */}
      {activeTab === "transcript" && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <CardTitle>Transcript</CardTitle>
            </div>
            <CardDescription>
              Recorded interview transcript
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-400">
              <FileText className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p>No transcript available yet.</p>
              <p className="text-sm mt-1">
                Transcripts appear after the candidate completes the interview.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
