import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Video, ResizeMode } from "expo-av";
import { interviewService } from "@/services/interviewService";
import LoadingScreen from "@/components/LoadingScreen";

export default function ReviewAnswerScreen() {
  const router = useRouter();
  const { token, questionId } = useLocalSearchParams<{ token: string; questionId: string }>();

  const [question, setQuestion] = useState<any>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);

  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "completed" | "error">("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [hasNextQuestion, setHasNextQuestion] = useState(false);
  const [nextQuestion, setNextQuestion] = useState<any>(null);

  useEffect(() => {
    if (token && questionId) {
      const q = interviewService.getQuestionById(token, questionId);
      const uri = interviewService.getStoredVideoUri(token, questionId);
      
      if (q && uri) {
        setQuestion(q);
        setVideoUri(uri);

        const next = interviewService.getNextQuestion(token, questionId);
        setHasNextQuestion(!!next);
        setNextQuestion(next);
      }
    }
  }, [token, questionId]);

  const handleUploadAndProceed = async () => {
    if (!token || !questionId || !videoUri) return;

    setUploadStatus("uploading");
    setUploadProgress(0);
    setUploadError(null);

    try {
      const result = await interviewService.uploadAnswer(
        token,
        questionId,
        videoUri,
        (progress) => {
          setUploadProgress(progress);
        }
      );

      if (result.status === "uploaded") {
        setUploadStatus("completed");
        
        // Wait a brief moment to show 100% completion before navigating
        setTimeout(() => {
          if (hasNextQuestion && nextQuestion) {
            router.replace(`/interview/${token}/question?questionId=${nextQuestion.id}`);
          } else {
            router.replace(`/interview/${token}/complete`);
          }
        }, 1000);
      } else {
        setUploadStatus("error");
        setUploadError(result.error || "Failed to upload response.");
      }
    } catch (err: any) {
      setUploadStatus("error");
      setUploadError(err.message || "An unexpected error occurred.");
    }
  };

  if (!question || !videoUri) {
    return <LoadingScreen message="Locating recorded response..." />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Review Response</Text>
      </View>

      <View style={styles.questionCard}>
        <Text style={styles.questionLabel}>Question</Text>
        <Text style={styles.questionText}>{question.question_text}</Text>
      </View>

      <View style={styles.videoContainer}>
        <Video
          source={{ uri: videoUri }}
          style={styles.videoPlayer}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
          isLooping={false}
        />
      </View>

      <View style={styles.footer}>
        {uploadStatus === "uploading" && (
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Uploading video response...</Text>
              <Text style={styles.progressValue}>{uploadProgress}%</Text>
            </View>
            <View style={styles.progressBarBackground}>
              <View
                style={[styles.progressBarFill, { width: `${uploadProgress}%` }]}
              />
            </View>
          </View>
        )}

        {uploadStatus === "completed" && (
          <View style={styles.successContainer}>
            <Text style={styles.successText}>Upload Complete! Continuing...</Text>
          </View>
        )}

        {uploadStatus === "error" && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{uploadError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleUploadAndProceed}>
              <Text style={styles.retryButtonText}>Retry Upload</Text>
            </TouchableOpacity>
          </View>
        )}

        {uploadStatus === "idle" && (
          <TouchableOpacity style={styles.submitButton} onPress={handleUploadAndProceed}>
            <Text style={styles.submitButtonText}>
              {hasNextQuestion ? "Submit & Next Question" : "Submit & Finish Interview"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    textAlign: "center",
  },
  questionCard: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
  },
  questionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  questionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
    lineHeight: 20,
  },
  videoContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  videoPlayer: {
    flex: 1,
  },
  footer: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderTopWidth: 1,
    borderColor: "#E2E8F0",
    paddingBottom: 28,
  },
  submitButton: {
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
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  progressContainer: {
    width: "100%",
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500",
  },
  progressValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2563EB",
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: "#E2E8F0",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#2563EB",
    borderRadius: 4,
  },
  successContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  successText: {
    color: "#16A34A",
    fontWeight: "700",
    fontSize: 15,
  },
  errorContainer: {
    alignItems: "center",
  },
  errorText: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: "#E2E8F0",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  retryButtonText: {
    color: "#475569",
    fontWeight: "600",
    fontSize: 13,
  },
});
