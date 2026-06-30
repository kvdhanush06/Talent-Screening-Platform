import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { interviewService } from "@/services/interviewService";
import LoadingScreen from "@/components/LoadingScreen";
import { getErrorMessage } from "@/lib/api";

export default function InterviewIntroScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<any>(null);

  useEffect(() => {
    async function loadDetails() {
      if (!token) return;
      try {
        const data = await interviewService.fetchInterviewDetails(token);
        setDetails(data);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }
    loadDetails();
  }, [token]);

  const handleStart = async () => {
    if (!token || !details) return;
    setLoading(true);
    try {
      // Start the interview on the backend
      await interviewService.startInterview(token);
      
      // Get the first question
      const firstQuestion = interviewService.getFirstQuestion(token);
      if (firstQuestion) {
        router.push(`/interview/${token}/question?questionId=${firstQuestion.id}`);
      } else {
        setError("No questions generated for this interview. Please contact the recruiter.");
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingScreen message="Loading interview guidelines..." />;
  }

  if (error || !details) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Oops! Something went wrong</Text>
          <Text style={styles.errorMessage}>{error || "Could not load interview details."}</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace("/")}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const { interview, questions } = details;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.welcomeText}>Welcome,</Text>
          <Text style={styles.candidateName}>{interview.candidate_name || "Candidate"}</Text>
        </View>

        <View style={styles.jobCard}>
          <Text style={styles.jobTitle}>{interview.job_title || "Position"}</Text>
          <Text style={styles.companyName}>{interview.company_name || "Hiring Company"}</Text>
        </View>

        <View style={styles.guidelinesCard}>
          <Text style={styles.sectionTitle}>Interview Guidelines</Text>
          
          <View style={styles.guidelineItem}>
            <View style={styles.numberBullet}><Text style={styles.bulletText}>1</Text></View>
            <View style={styles.guidelineTextContainer}>
              <Text style={styles.guidelineHeader}>Question Formats</Text>
              <Text style={styles.guidelineBody}>
                You will be presented with {questions.length} questions calibrated specifically to your profile and the role description.
              </Text>
            </View>
          </View>

          <View style={styles.guidelineItem}>
            <View style={styles.numberBullet}><Text style={styles.bulletText}>2</Text></View>
            <View style={styles.guidelineTextContainer}>
              <Text style={styles.guidelineHeader}>Think & Recording Limits</Text>
              <Text style={styles.guidelineBody}>
                For each question, you get a 30-second prep timer followed by up to 3 minutes to record your video response.
              </Text>
            </View>
          </View>

          <View style={styles.guidelineItem}>
            <View style={styles.numberBullet}><Text style={styles.bulletText}>3</Text></View>
            <View style={styles.guidelineTextContainer}>
              <Text style={styles.guidelineHeader}>Submission Policy</Text>
              <Text style={styles.guidelineBody}>
                You cannot pause or re-record responses once submitted. All uploads run progressively in the background.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            Please ensure you grant camera and microphone permissions on the next screen. Keep your phone steady and speak clearly.
          </Text>
        </View>

        <TouchableOpacity style={styles.startButton} onPress={handleStart}>
          <Text style={styles.startButtonText}>Begin Interview</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollContent: {
    padding: 24,
  },
  header: {
    marginBottom: 24,
    marginTop: 16,
  },
  welcomeText: {
    fontSize: 16,
    color: "#64748B",
    fontWeight: "500",
  },
  candidateName: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1E293B",
  },
  jobCard: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 16,
    padding: 20,
    marginBottom: 28,
  },
  jobTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1D4ED8",
  },
  companyName: {
    fontSize: 14,
    color: "#1E40AF",
    marginTop: 4,
    fontWeight: "500",
  },
  guidelinesCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 20,
  },
  guidelineItem: {
    flexDirection: "row",
    marginBottom: 20,
  },
  numberBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginTop: 2,
  },
  bulletText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  guidelineTextContainer: {
    flex: 1,
  },
  guidelineHeader: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
  },
  guidelineBody: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
    marginTop: 4,
  },
  warningBox: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
  },
  warningText: {
    fontSize: 13,
    color: "#B45309",
    lineHeight: 18,
    fontWeight: "500",
  },
  startButton: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 24,
  },
  startButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#DC2626",
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: "#E2E8F0",
    borderRadius: 8,
  },
  backButtonText: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "600",
  },
});
