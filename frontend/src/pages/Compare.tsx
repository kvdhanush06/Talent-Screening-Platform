import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { jobs as jobsApi, compare as compareApi, candidates as candidatesApi } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/ui/loading";
import { useToast } from "@/components/ui/toast";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { getScoreColor, getScoreBgColor } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { BarChart3, Loader2, Download, FileText, CheckSquare, Square } from "lucide-react";
import type { ComparisonResult } from "@/types";

export default function Compare() {
  const { toast } = useToast();
  const [selectedJob, setSelectedJob] = useState("");
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);

  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => jobsApi.list(),
  });

  const { data: candidatesData, isLoading: candidatesLoading } = useQuery({
    queryKey: ["candidates", "job", selectedJob],
    queryFn: () => candidatesApi.list({ job_id: selectedJob }),
    enabled: !!selectedJob,
  });

  const compareMutation = useMutation({
    mutationFn: () =>
      compareApi.compareCandidates(selectedJob, selectedCandidates),
    onSuccess: () => {
      toast("success", "Comparison Complete", "Candidates have been compared.");
    },
    onError: () => {
      toast("error", "Comparison Failed", "Could not compare candidates.");
    },
  });

  const jobOptions = jobsData?.map((j) => ({
    value: j.id,
    label: j.title,
  })) || [{ value: "", label: "Select a job" }];

  const toggleCandidate = (id: string) => {
    setSelectedCandidates((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const result = compareMutation.data;

  const candidateChartData = result?.candidates?.map((c) => ({
    name: c.candidate.name.split(" ")[0],
    Skills: c.scores?.skills_score || 0,
    Experience: c.scores?.experience_score || 0,
    Education: c.scores?.education_score || 0,
    "Cultural Fit": c.scores?.cultural_fit_score || 0,
    Overall: c.scores?.overall_score || 0,
  })) || [];

  const handleExport = () => {
    if (!result) return;
    const text = [
      `Comparison Report - ${result.summary.job_title}`,
      "",
      `Summary: Compared ${result.summary.total_compared} candidates. Highest scored: ${result.summary.highest_scored || "N/A"}`,
      `Recommendation: ${result.summary.recommendation || "N/A"}`,
      "",
      ...result.candidates.map((c) => {
        const s = c.scores as any;
        return [
          `--- ${c.candidate.name} ---`,
          `Overall Score: ${s?.overall_score || "N/A"}`,
          `Skills: ${s?.skills_score || "N/A"}`,
          `Experience: ${s?.experience_score || "N/A"}`,
          `Education: ${s?.education_score || "N/A"}`,
          `Cultural Fit: ${s?.cultural_fit_score || "N/A"}`,
          "",
        ].join("\n");
      }),
    ].join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comparison-${result.summary.job_title.replace(/\s+/g, "-").toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compare Candidates</h1>
          <p className="text-gray-500 mt-1">
            Select candidates side-by-side to compare their evaluations.
          </p>
        </div>
      </div>

      {/* Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Selection</CardTitle>
          <CardDescription>
            Choose a job and select candidates to compare
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-sm">
            <Select
              options={[{ value: "", label: "Select a job..." }, ...jobOptions.slice(0, 1), ...(jobsData?.map(j => ({ value: String(j.id), label: j.title })) || [])]}
              value={selectedJob}
              onChange={(e) => {
                setSelectedJob(e.target.value);
                setSelectedCandidates([]);
              }}
              placeholder="Select a job..."
            />
          </div>

          {selectedJob && (
            <>
              {candidatesLoading ? (
                <Loading size="sm" />
              ) : !candidatesData || candidatesData.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">
                  No candidates for this job. Search for candidates first.
                </p>
              ) : (
                <div className="space-y-2">
                  {candidatesData.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => toggleCandidate(c.id)}
                    >
                      <div className="flex items-center gap-3">
                        {selectedCandidates.includes(c.id) ? (
                          <CheckSquare className="h-5 w-5 text-blue-600" />
                        ) : (
                          <Square className="h-5 w-5 text-gray-300" />
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{c.name}</p>
                          <p className="text-sm text-gray-500">
                            {c.current_title || "N/A"}
                          </p>
                        </div>
                      </div>
                      {c.match_score !== null && c.match_score !== undefined && (
                        <Badge className={getScoreBgColor(c.match_score)}>
                          {c.match_score}%
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <Button
                onClick={() => compareMutation.mutate()}
                disabled={
                  selectedCandidates.length < 2 || compareMutation.isPending
                }
              >
                {compareMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <BarChart3 className="mr-2 h-4 w-4" />
                )}
                Compare ({selectedCandidates.length})
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {compareMutation.isPending && <Loading text="Comparing candidates..." />}

      {result && !compareMutation.isPending && (
        <>
          {/* Summary */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Comparison Results</CardTitle>
                  <CardDescription>{result.summary.job_title}</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="mr-1 h-4 w-4" />
                  Export
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Chart */}
              {candidateChartData.length > 0 && (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={candidateChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Skills" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="Experience" fill="#22c55e" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="Education" fill="#eab308" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="Cultural Fit" fill="#a855f7" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <Separator />

              {/* Comparison Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Criteria</TableHead>
                    {result.candidates.map((c) => (
                      <TableHead key={c.candidate.id}>{c.candidate.name}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { label: "Overall Score", key: "overall_score" },
                    { label: "Skills", key: "skills_score" },
                    { label: "Experience", key: "experience_score" },
                    { label: "Education", key: "education_score" },
                    { label: "Cultural Fit", key: "cultural_fit_score" },
                  ].map((row) => (
                    <TableRow key={row.key}>
                      <TableCell className="font-medium">{row.label}</TableCell>
                      {result.candidates.map((c) => {
                        const value =
                          c.scores?.[row.key as keyof typeof c.scores] as number | undefined;
                        return (
                          <TableCell key={c.candidate.id}>
                            <span className={`font-semibold ${getScoreColor(value)}`}>
                              {value ?? "N/A"}
                            </span>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell className="font-medium">Status</TableCell>
                    {result.candidates.map((c) => (
                      <TableCell key={c.candidate.id}>
                        <Badge variant="secondary">{c.candidate.status}</Badge>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>

              <Separator />

              {/* AI Summary */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">AI Summary</h3>
                <p className="text-gray-600">
                  Compared {result.summary.total_compared} candidates. 
                  {result.summary.highest_scored ? ` The highest matching candidate based on semantic profiles is ${result.summary.highest_scored}.` : ""}
                </p>
              </div>

              {/* Recommendation */}
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <h4 className="font-semibold text-blue-800 mb-1">Recommendation</h4>
                <p className="text-sm text-blue-700">{result.summary.recommendation}</p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
