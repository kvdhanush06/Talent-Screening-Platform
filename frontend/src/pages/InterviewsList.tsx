import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { interviews as interviewsApi, jobs as jobsApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Loading } from "@/components/ui/loading";
import { formatDate } from "@/lib/utils";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Search, CalendarCheck } from "lucide-react";

export default function InterviewsList() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState("");

  const { data: interviews, isLoading } = useQuery({
    queryKey: ["interviews"],
    queryFn: () => interviewsApi.list(),
  });

  const { data: jobsData } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => jobsApi.list(),
  });

  const filteredInterviews = (interviews || []).filter(
    (i) => !statusFilter || i.status === statusFilter
  );

  const statusOptions = [
    { value: "scheduled", label: "Scheduled" },
    { value: "in_progress", label: "In Progress" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
  ];

  const getStatusVariant = (status: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      scheduled: "outline",
      in_progress: "default",
      completed: "secondary",
      cancelled: "destructive",
    };
    return map[status] || "secondary";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Interviews</h1>
        <p className="text-gray-500 mt-1">
          Manage candidate interviews and review scorecards.
        </p>
      </div>

      <div className="flex gap-3">
        <Select
          options={[{ value: "", label: "All Statuses" }, ...statusOptions]}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full sm:w-44"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <Loading text="Loading interviews..." />
          ) : filteredInterviews.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <CalendarCheck className="h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">
                No interviews found
              </h3>
              <p className="text-gray-500 mt-1">
                {statusFilter
                  ? "No interviews match the selected status."
                  : "Schedule an interview from a job detail page."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInterviews.map((interview) => (
                  <TableRow
                    key={interview.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/interviews/${interview.id}`)}
                  >
                    <TableCell className="font-medium">
                      {interview.candidate_name || `Candidate #${interview.candidate_id}`}
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {interview.job_title || `Job #${interview.job_id}`}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(interview.status)}>
                        {interview.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {interview.invited_at
                        ? formatDate(interview.invited_at)
                        : "Not scheduled"}
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {formatDate(interview.created_at)}
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
