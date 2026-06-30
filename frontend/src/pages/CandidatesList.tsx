import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { candidates as candidatesApi, jobs as jobsApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Loading } from "@/components/ui/loading";
import { useToast } from "@/components/ui/toast";
import { getScoreColor, formatDate } from "@/lib/utils";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Search, Star, StarOff, Users, Loader2 } from "lucide-react";

export default function CandidatesList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [jobFilter, setJobFilter] = useState(searchParams.get("job_id") || "");

  const { data: candidatesData, isLoading } = useQuery({
    queryKey: ["candidates"],
    queryFn: () => candidatesApi.list(),
  });

  const { data: jobsData } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => jobsApi.list(),
  });

  const shortlistMutation = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) =>
      candidatesApi.shortlist(id, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: () => {
      toast("error", "Failed to Update", "Could not update shortlist status.");
    },
  });

  const filteredCandidates = (candidatesData || []).filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.current_title || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.current_company || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || c.status === statusFilter;
    const matchesJob = !jobFilter || c.job_id === jobFilter;
    return matchesSearch && matchesStatus && matchesJob;
  });

  const statusOptions = [
    { value: "new", label: "New" },
    { value: "pending", label: "Pending" },
    { value: "shortlisted", label: "Shortlisted" },
    { value: "rejected", label: "Rejected" },
    { value: "invited", label: "Invited" },
  ];

  const jobOptions =
    jobsData?.map((j) => ({ value: String(j.id), label: j.title })) || [];

  const getStatusVariant = (status: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      shortlisted: "default",
      pending: "secondary",
      new: "outline",
      rejected: "destructive",
      invited: "default",
    };
    return map[status] || "secondary";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Candidates</h1>
        <p className="text-gray-500 mt-1">
          Review and manage candidates across all job postings.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search candidates..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          options={[{ value: "", label: "All Statuses" }, ...statusOptions]}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full sm:w-40"
        />
        <Select
          options={[{ value: "", label: "All Jobs" }, ...jobOptions]}
          value={jobFilter}
          onChange={(e) => setJobFilter(e.target.value)}
          className="w-full sm:w-48"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <Loading text="Loading candidates..." />
          ) : filteredCandidates.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <Users className="h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No candidates found</h3>
              <p className="text-gray-500 mt-1">
                {search || statusFilter || jobFilter
                  ? "Try adjusting your filters."
                  : "No candidates have been added yet."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Current Title</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Match Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Shortlist</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCandidates.map((candidate) => (
                  <TableRow
                    key={candidate.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/candidates/${candidate.id}`)}
                  >
                    <TableCell className="font-medium">{candidate.name}</TableCell>
                    <TableCell className="text-gray-600">
                      {candidate.current_title || "N/A"}
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {candidate.current_company || "N/A"}
                    </TableCell>
                    <TableCell>
                      {candidate.match_score !== null &&
                      candidate.match_score !== undefined ? (
                        <span
                          className={`font-semibold ${getScoreColor(candidate.match_score)}`}
                        >
                          {candidate.match_score}%
                        </span>
                      ) : (
                        <span className="text-gray-400">--</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(candidate.status)}>
                        {candidate.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          shortlistMutation.mutate({
                            id: candidate.id,
                            value: !candidate.is_shortlisted,
                          });
                        }}
                        className="cursor-pointer"
                      >
                        {candidate.is_shortlisted ? (
                          <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                        ) : (
                          <StarOff className="h-5 w-5 text-gray-300 hover:text-gray-400" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/candidates/${candidate.id}`);
                        }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
