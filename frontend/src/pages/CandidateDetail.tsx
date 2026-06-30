import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { candidates as candidatesApi, interviews as interviewsApi } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/ui/loading";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/toast";
import { getScoreColor, formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Star,
  StarOff,
  Sparkles,
  Loader2,
  Award,
  TrendingUp,
  ThumbsUp,
  AlertTriangle,
  Calendar,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const candidateId = id || "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: candidate, isLoading } = useQuery({
    queryKey: ["candidate", candidateId],
    queryFn: () => candidatesApi.get(candidateId),
    enabled: !!candidateId,
  });

  const { data: candidateInterviews } = useQuery({
    queryKey: ["candidate-interviews", candidateId],
    queryFn: () => interviewsApi.list(),
    enabled: !!candidateId,
  });

  const candidateInterview = (candidateInterviews || []).find(
    (i) => i.candidate_id === candidateId
  );

  const { data: scorecard } = useQuery({
    queryKey: ["scorecard", candidateInterview?.id],
    queryFn: () => interviewsApi.getScorecard(candidateInterview!.id),
    enabled: !!candidateInterview?.id,
  });

  const evaluateMutation = useMutation({
    mutationFn: () => candidatesApi.evaluate(candidateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidate", candidateId] });
      toast("success", "Evaluation Complete", "Candidate has been evaluated successfully.");
    },
    onError: () => {
      toast("error", "Evaluation Failed", "Could not evaluate candidate.");
    },
  });

  const shortlistMutation = useMutation({
    mutationFn: (value: boolean) => candidatesApi.shortlist(candidateId, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidate", candidateId] });
      toast(
        "success",
        candidate?.is_shortlisted ? "Removed from Shortlist" : "Added to Shortlist",
        candidate?.is_shortlisted
          ? "Candidate removed from shortlist."
          : "Candidate has been shortlisted."
      );
    },
    onError: () => {
      toast("error", "Failed to Update", "Could not update shortlist status.");
    },
  });

  if (isLoading) return <Loading text="Loading candidate details..." />;
  if (!candidate)
    return <div className="text-center py-16 text-gray-500">Candidate not found</div>;

  const latestScore = candidate.scores || null;

  const scoreChartData = latestScore
    ? [
        { name: "Skills", score: latestScore.skills_score },
        { name: "Experience", score: latestScore.experience_score },
        { name: "Education", score: latestScore.education_score },
        { name: "Cultural Fit", score: latestScore.cultural_fit_score },
      ]
    : [];

  const recommendationColor = (rec: string) => {
    if (rec === "strong_yes" || rec === "yes") return "text-green-600 bg-green-50 border-green-200";
    if (rec === "maybe") return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  return (
    <div className="space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate("/candidates")}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Candidates
      </button>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Profile */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Card */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xl font-bold">
                    {candidate.name.charAt(0)}
                  </div>
                  <div>
                    <CardTitle className="text-xl">{candidate.name}</CardTitle>
                    <CardDescription className="text-base">
                      {candidate.current_title || "No title"}
                    </CardDescription>
                    {candidate.current_company && (
                      <p className="text-sm text-gray-500">
                        at {candidate.current_company}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => shortlistMutation.mutate(!candidate.is_shortlisted)}
                  >
                    {candidate.is_shortlisted ? (
                      <StarOff className="mr-1 h-4 w-4" />
                    ) : (
                      <Star className="mr-1 h-4 w-4" />
                    )}
                    {candidate.is_shortlisted ? "Unshortlist" : "Shortlist"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => evaluateMutation.mutate()}
                    disabled={evaluateMutation.isPending}
                  >
                    {evaluateMutation.isPending ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1 h-4 w-4" />
                    )}
                    Evaluate
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 mb-4">
                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                  <Mail className="h-4 w-4 text-gray-400" />
                  {candidate.email}
                </div>
                {candidate.phone && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <Phone className="h-4 w-4 text-gray-400" />
                    {candidate.phone}
                  </div>
                )}
                {candidate.location && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    {candidate.location}
                  </div>
                )}
              </div>

              {candidate.summary && (
                <>
                  <Separator className="mb-4" />
                  <p className="text-gray-600">{candidate.summary}</p>
                </>
              )}

              {/* Skills */}
              {candidate.skills && candidate.skills.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <h3 className="font-semibold text-gray-900 mb-3">Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {candidate.skills.map((skill, i) => (
                      <Badge key={i} variant="secondary" className="text-sm py-1 px-3">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Experience */}
          {candidate.experience && candidate.experience.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-blue-600" />
                  <CardTitle>Experience</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {candidate.experience.map((exp, i) => (
                    <div key={i}>
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">{exp.title}</h4>
                          <p className="text-sm text-gray-600">{exp.company}</p>
                        </div>
                        <span className="text-sm text-gray-400">
                          {exp.start_date || ""} - {exp.current ? "Present" : exp.end_date || ""}
                        </span>
                      </div>
                      {exp.description && (
                        <p className="text-sm text-gray-600 mt-2">{exp.description}</p>
                      )}
                      {i < candidate.experience.length - 1 && (
                        <Separator className="mt-4" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Education */}
          {candidate.education && candidate.education.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-blue-600" />
                  <CardTitle>Education</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {candidate.education.map((edu, i) => (
                    <div key={i}>
                      <h4 className="font-medium text-gray-900">{edu.degree}</h4>
                      <p className="text-sm text-gray-600">{edu.institution}</p>
                      {edu.field && (
                        <p className="text-sm text-gray-500">{edu.field}</p>
                      )}
                      {i < candidate.education.length - 1 && <Separator className="mt-4" />}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Scores */}
        <div className="space-y-6">
          {/* Overall Score */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                <CardTitle>AI Score</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {!latestScore ? (
                <div className="text-center py-8">
                  <Sparkles className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">Not yet evaluated</p>
                  <Button
                    size="sm"
                    className="mt-3"
                    onClick={() => evaluateMutation.mutate()}
                    disabled={evaluateMutation.isPending}
                  >
                    {evaluateMutation.isPending ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1 h-4 w-4" />
                    )}
                    Evaluate Now
                  </Button>
                </div>
              ) : (
                <>
                  <div className="text-center mb-6">
                    <div
                      className={`inline-flex items-center justify-center h-20 w-20 rounded-full text-2xl font-bold ${
                        latestScore.overall_score >= 80
                          ? "bg-green-100 text-green-700"
                          : latestScore.overall_score >= 60
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {latestScore.overall_score}
                    </div>
                    <p className="text-sm text-gray-500 mt-2">Overall Score</p>
                  </div>

                  {/* Score Bars */}
                  <div className="space-y-3">
                    {scoreChartData.map((item) => (
                      <div key={item.name}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">{item.name}</span>
                          <span className={getScoreColor(item.score)}>
                            {item.score}
                          </span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              item.score >= 80
                                ? "bg-green-500"
                                : item.score >= 60
                                ? "bg-yellow-500"
                                : "bg-red-500"
                            }`}
                            style={{ width: `${item.score}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Strengths */}
                  {latestScore.strengths?.length > 0 && (
                    <>
                      <Separator className="my-4" />
                      <h4 className="text-sm font-semibold text-green-700 flex items-center gap-1 mb-2">
                        <ThumbsUp className="h-4 w-4" /> Strengths
                      </h4>
                      <ul className="space-y-1">
                        {latestScore.strengths.map((s, i) => (
                          <li key={i} className="text-sm text-gray-600 flex items-start gap-1.5">
                            <span className="text-green-500 mt-0.5">&#x2022;</span>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}

                  {/* Concerns */}
                  {latestScore.concerns?.length > 0 && (
                    <>
                      <Separator className="my-4" />
                      <h4 className="text-sm font-semibold text-red-700 flex items-center gap-1 mb-2">
                        <AlertTriangle className="h-4 w-4" /> Concerns
                      </h4>
                      <ul className="space-y-1">
                        {latestScore.concerns.map((c, i) => (
                          <li key={i} className="text-sm text-gray-600 flex items-start gap-1.5">
                            <span className="text-red-500 mt-0.5">&#x2022;</span>
                            {c}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}

                  {/* Recommendation */}
                  {latestScore.recommendation && (
                    <>
                      <Separator className="my-4" />
                      <div
                        className={`rounded-lg border p-3 text-center font-medium text-sm ${recommendationColor(
                          latestScore.recommendation
                        )}`}
                      >
                        Recommendation: {latestScore.recommendation.replace("_", " ")}
                      </div>
                    </>
                  )}

                  {/* Red Flags */}
                  {latestScore.red_flags && latestScore.red_flags.length > 0 && (
                    <>
                      <Separator className="my-4" />
                      <h4 className="text-sm font-semibold text-amber-700 flex items-center gap-1 mb-2">
                        <AlertTriangle className="h-4 w-4" /> Red Flags
                      </h4>
                      <ul className="space-y-2">
                        {latestScore.red_flags.map((flag: any, i: number) => (
                          <li key={i} className="text-sm border border-amber-200 bg-amber-50 rounded-md p-2.5 flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                            <div>
                              <p className="font-medium text-amber-800 capitalize text-xs">{flag.type.replace("_", " ")} ({flag.severity})</p>
                              <p className="text-amber-700 text-xs mt-0.5">{flag.detail}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Interview Details Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                <CardTitle>Interview Status</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {!candidateInterview ? (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-400">No interview scheduled yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500 font-medium">Status</span>
                    <Badge variant="secondary">
                      {candidateInterview.status}
                    </Badge>
                  </div>
                  {candidateInterview.status === "completed" && scorecard && (
                    <div className="space-y-4 pt-2">
                      <Separator />
                      <div className="text-center">
                        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 text-blue-700 text-lg font-bold">
                          {scorecard.overall_score}%
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Interview Score</p>
                      </div>
                      
                      {scorecard.summary && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">AI Summary</h4>
                          <p className="text-sm text-gray-600 leading-relaxed">{scorecard.summary}</p>
                        </div>
                      )}

                      {scorecard.follow_up_questions && scorecard.follow_up_questions.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Recommended Follow-Ups</h4>
                          <ul className="space-y-1">
                            {scorecard.follow_up_questions.map((q: string, idx: number) => (
                              <li key={idx} className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded p-2">
                                {q}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
