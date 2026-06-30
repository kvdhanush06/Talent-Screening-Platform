import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { jobs as jobsApi, candidates as candidatesApi, interviews as interviewsApi } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/ui/loading";
import { Separator } from "@/components/ui/separator";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";
import {
  MapPin,
  Building2,
  Clock,
  UserCheck,
  AlertTriangle,
  Brain,
  Users,
  ArrowLeft,
  BarChart3,
  Sparkles,
  Loader2,
  CheckCircle,
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

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const jobId = id || "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [analysisTab, setAnalysisTab] = useState("skills");
  const [interviewDialog, setInterviewDialog] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);

  const { data: job, isLoading: jobLoading } = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => jobsApi.get(jobId),
    enabled: !!jobId,
  });

  const { data: analysis, isLoading: analysisLoading } = useQuery({
    queryKey: ["job-analysis", jobId],
    queryFn: () => jobsApi.getAnalysis(jobId),
    enabled: !!jobId,
  });

  const { data: jobCandidates, isLoading: candidatesLoading } = useQuery({
    queryKey: ["candidates", "job", jobId],
    queryFn: () => candidatesApi.list({ job_id: jobId }),
    enabled: !!jobId,
  });

  const analyzeMutation = useMutation({
    mutationFn: () => jobsApi.analyze(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-analysis", jobId] });
      toast("success", "Analysis Complete", "Job description has been analyzed successfully.");
    },
    onError: () => {
      toast("error", "Analysis Failed", "Could not analyze the job description.");
    },
  });

  const evaluateAllMutation = useMutation({
    mutationFn: () => candidatesApi.evaluateAll(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidates", "job", jobId] });
      toast("success", "Evaluation Complete", "All candidates have been evaluated.");
    },
    onError: () => {
      toast("error", "Evaluation Failed", "Could not evaluate candidates.");
    },
  });

  const createInterviewMutation = useMutation({
    mutationFn: (data: { job_id: string; candidate_id: string }) =>
      interviewsApi.create(data),
    onSuccess: (interview) => {
      setInterviewDialog(false);
      setSelectedCandidate(null);
      queryClient.invalidateQueries({ queryKey: ["interviews"] });
      toast("success", "Interview Created", "Interview invitation has been sent.");
      navigate(`/interviews/${interview.id}`);
    },
    onError: () => {
      toast("error", "Failed to Create Interview", "Please try again.");
    },
  });

  const statusVariant = (status: string) => {
    if (status === "active") return "default" as const;
    if (status === "closed") return "destructive" as const;
    return "secondary" as const;
  };

  const getScoreColor = (score: number | undefined | null) => {
    if (score === null || score === undefined) return "#9ca3af";
    if (score >= 80) return "#22c55e";
    if (score >= 60) return "#eab308";
    return "#ef4444";
  };

  if (jobLoading) return <Loading text="Loading job details..." />;
  if (!job) return <div className="text-center py-16 text-gray-500">Job not found</div>;

  const candidateChartData = (jobCandidates || []).map((c) => ({
    name: c.name.split(" ")[0],
    score: c.match_score || 0,
    fill: getScoreColor(c.match_score),
  }));

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate("/jobs")}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Jobs
      </button>

      {/* Job Info Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <CardTitle className="text-2xl">{job.title}</CardTitle>
                <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
              </div>
              <CardDescription>{job.department}</CardDescription>
            </div>
            <div className="flex gap-2">
              {!analysis && (
                <Button
                  variant="outline"
                  onClick={() => analyzeMutation.mutate()}
                  disabled={analyzeMutation.isPending}
                >
                  {analyzeMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Brain className="mr-2 h-4 w-4" />
                  )}
                  Analyze JD
                </Button>
              )}
              <Button
                onClick={() => evaluateAllMutation.mutate()}
                disabled={evaluateAllMutation.isPending || !jobCandidates?.length}
              >
                {evaluateAllMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Evaluate All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="h-4 w-4 text-gray-400" />
              {job.location}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Building2 className="h-4 w-4 text-gray-400" />
              {job.employment_type}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <UserCheck className="h-4 w-4 text-gray-400" />
              {job.experience_level}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="h-4 w-4 text-gray-400" />
              Created {formatDate(job.created_at)}
            </div>
          </div>

          <Separator className="mb-6" />

          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
              <p className="text-gray-600 whitespace-pre-wrap">{job.description}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analysis Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-600" />
            <CardTitle>AI Analysis</CardTitle>
          </div>
          <CardDescription>
            Structured requirements extracted from the job description
          </CardDescription>
        </CardHeader>
        <CardContent>
          {analysisLoading ? (
            <Loading size="sm" text="Loading analysis..." />
          ) : !analysis ? (
            <div className="flex flex-col items-center py-12 text-center">
              <Brain className="h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No Analysis Yet</h3>
              <p className="text-gray-500 mt-1 mb-4">
                Click the "Analyze JD" button to extract structured requirements.
              </p>
              <Button
                onClick={() => analyzeMutation.mutate()}
                disabled={analyzeMutation.isPending}
              >
                {analyzeMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Brain className="mr-2 h-4 w-4" />
                )}
                Analyze Now
              </Button>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex gap-1 mb-6 border-b border-gray-200">
                {["skills", "experience", "education", "responsibilities"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setAnalysisTab(tab)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize cursor-pointer ${
                      analysisTab === tab
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div>
                {analysisTab === "skills" && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Required Skills</h4>
                    <div className="flex flex-wrap gap-2">
                      {analysis.required_skills?.length > 0 ? (
                        analysis.required_skills.map((skill: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-sm py-1 px-3">
                            {skill}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-gray-400">No required skills listed</p>
                      )}
                    </div>
                    {analysis.preferred_skills?.length > 0 && (
                      <>
                        <h4 className="font-medium text-gray-900 mt-6 mb-3">Preferred Skills</h4>
                        <div className="flex flex-wrap gap-2">
                          {analysis.preferred_skills.map((skill: string, i: number) => (
                            <Badge key={i} className="text-sm py-1 px-3 bg-blue-50 text-blue-800">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </>
                    )}
                    {analysis.soft_skills?.length > 0 && (
                      <>
                        <h4 className="font-medium text-gray-900 mt-6 mb-3">Soft Skills</h4>
                        <div className="flex flex-wrap gap-2">
                          {analysis.soft_skills.map((skill: string, i: number) => (
                            <Badge key={i} className="text-sm py-1 px-3 bg-purple-100 text-purple-800">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {analysisTab === "experience" && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Experience Required</h4>
                    <div className="flex items-center gap-3 text-lg">
                      <Clock className="h-5 w-5 text-blue-600" />
                      <span className="font-semibold">
                        {analysis.experience_required?.years || 0}+ years ({analysis.experience_required?.level || "mid"})
                      </span>
                    </div>
                  </div>
                )}

                {analysisTab === "education" && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Education Requirements</h4>
                    {analysis.education_required ? (
                      <div className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                        <span className="text-gray-700">{analysis.education_required}</span>
                      </div>
                    ) : (
                      <p className="text-gray-400">No education requirements specified</p>
                    )}
                  </div>
                )}

                {analysisTab === "responsibilities" && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Key Responsibilities</h4>
                    {analysis.key_responsibilities?.length > 0 ? (
                      <ul className="space-y-2">
                        {analysis.key_responsibilities.map((resp: string, i: number) => (
                          <li key={i} className="flex items-start gap-2">
                            <div className="h-2 w-2 rounded-full bg-blue-500 mt-2 shrink-0" />
                            <span className="text-gray-700">{resp}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-400">No responsibilities listed</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Candidates Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              <CardTitle>Candidates ({jobCandidates?.length || 0})</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/candidates?job_id=${jobId}`)}
            >
              View All
            </Button>
          </div>
          <CardDescription>Candidates matched to this position</CardDescription>
        </CardHeader>
        <CardContent>
          {candidatesLoading ? (
            <Loading size="sm" />
          ) : !jobCandidates || jobCandidates.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <Users className="h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No Candidates Yet</h3>
              <p className="text-gray-500 mt-1">
                Search and evaluate candidates to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Score Chart */}
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={candidateChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Bar dataKey="score" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Candidate List */}
              <div className="space-y-3">
                {jobCandidates.map((candidate) => (
                  <div
                    key={candidate.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/candidates/${candidate.id}`)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-semibold text-sm">
                        {candidate.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{candidate.name}</p>
                        <p className="text-sm text-gray-500">
                          {candidate.current_title || "N/A"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {candidate.match_score !== undefined && candidate.match_score !== null && (
                        <div
                          className={`text-sm font-semibold px-2.5 py-1 rounded-full ${
                            candidate.match_score >= 80
                              ? "bg-green-100 text-green-800"
                              : candidate.match_score >= 60
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {candidate.match_score}%
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCandidate(candidate.id);
                          setInterviewDialog(true);
                        }}
                      >
                        Schedule Interview
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Interview Dialog */}
      <Dialog
        open={interviewDialog}
        onClose={() => {
          setInterviewDialog(false);
          setSelectedCandidate(null);
        }}
        title="Schedule Interview"
        description="Create an interview invitation for this candidate."
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            An interview will be created for the selected candidate. They will receive
            an invitation to complete an async video interview.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setInterviewDialog(false);
                setSelectedCandidate(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedCandidate) {
                  createInterviewMutation.mutate({
                    job_id: jobId,
                    candidate_id: selectedCandidate,
                  });
                }
              }}
              disabled={createInterviewMutation.isPending}
            >
              {createInterviewMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Create Interview
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
