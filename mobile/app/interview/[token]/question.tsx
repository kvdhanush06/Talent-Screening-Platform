import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Camera } from "expo-camera";
import { interviewService } from "@/services/interviewService";
import LoadingScreen from "@/components/LoadingScreen";

const { width } = Dimensions.get("window");

export default function RecordQuestionScreen() {
  const router = useRouter();
  const { token, questionId } = useLocalSearchParams<{ token: string; questionId: string }>();

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [hasAudioPermission, setHasAudioPermission] = useState<boolean | null>(null);
  
  const [question, setQuestion] = useState<any>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);

  const [phase, setPhase] = useState<"think" | "record">("think");
  const [timeLeft, setTimeLeft] = useState(30);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  const cameraRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Request permissions
  useEffect(() => {
    (async () => {
      const cameraStatus = await Camera.requestCameraPermissionsAsync();
      const audioStatus = await Camera.requestMicrophonePermissionsAsync();
      setHasCameraPermission(cameraStatus.status === "granted");
      setHasAudioPermission(audioStatus.status === "granted");
    })();
  }, []);

  // Load question data
  useEffect(() => {
    if (token && questionId) {
      const q = interviewService.getQuestionById(token, questionId);
      if (q) {
        setQuestion(q);
        setCurrentIndex(interviewService.getQuestionIndex(token, questionId) + 1);
        setTotalQuestions(interviewService.getQuestionCount(token));
        setPhase("think");
        setTimeLeft(q.think_time_seconds || 30);
      }
    }
  }, [token, questionId]);

  // Handle countdown logic
  useEffect(() => {
    if (!question) return;

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          if (phase === "think") {
            // Automatically start recording when think time ends
            triggerRecording();
          } else {
            // Automatically stop recording when recording time ends
            triggerStopRecording();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [question, phase]);

  const triggerRecording = async () => {
    setPhase("record");
    setTimeLeft(question.time_limit_seconds || 180);
    setIsRecording(true);

    // Small delay to ensure the camera transitions cleanly
    setTimeout(async () => {
      if (cameraRef.current && cameraReady) {
        try {
          const videoRecordPromise = cameraRef.current.recordAsync({
            maxDuration: question.time_limit_seconds || 180,
            quality: "720p",
          });

          const data = await videoRecordPromise;
          if (data && data.uri) {
            interviewService.storeVideoUri(token, questionId, data.uri);
            // Navigate to review screen
            router.push(`/interview/${token}/review?questionId=${questionId}`);
          }
        } catch (err) {
          console.error("Recording failed to start", err);
          setIsRecording(false);
          setPhase("think");
          setTimeLeft(30);
        }
      }
    }, 500);
  };

  const triggerStopRecording = async () => {
    if (cameraRef.current && isRecording) {
      try {
        cameraRef.current.stopRecording();
        setIsRecording(false);
      } catch (err) {
        console.error("Recording failed to stop", err);
      }
    }
  };

  const handleSkipPrep = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    triggerRecording();
  };

  const handleStopAndSubmit = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    triggerStopRecording();
  };

  if (hasCameraPermission === null || hasAudioPermission === null) {
    return <LoadingScreen message="Requesting hardware permissions..." />;
  }

  if (hasCameraPermission === false || hasAudioPermission === false) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Permissions Required</Text>
          <Text style={styles.errorMessage}>
            Talent Screen requires access to your camera and microphone to capture your responses. Please enable them in your device settings.
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace("/")}
          >
            <Text style={styles.backButtonText}>Return Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!question) {
    return <LoadingScreen message="Locating question..." />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.progressText}>
          Question {currentIndex} of {totalQuestions}
        </Text>
        <View style={[
          styles.badge,
          phase === "think" ? styles.badgeThink : styles.badgeRecord
        ]}>
          <Text style={styles.badgeText}>
            {phase === "think" ? "Prep Time" : "Recording"}
          </Text>
        </View>
      </View>

      <View style={styles.questionCard}>
        <Text style={styles.questionText}>{question.question_text}</Text>
      </View>

      <View style={styles.cameraContainer}>
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFillObject}
          facing="front"
          onCameraReady={() => setCameraReady(true)}
        />
        {phase === "think" && (
          <View style={styles.cameraOverlay}>
            <Text style={styles.countdownTitle}>PREPARING RESPONSE</Text>
            <Text style={styles.countdownNumber}>{timeLeft}</Text>
            <Text style={styles.countdownSub}>Recording starts automatically</Text>
          </View>
        )}
      </View>

      <View style={styles.controls}>
        {phase === "think" ? (
          <View style={styles.footerInfo}>
            <Text style={styles.timerSubText}>Prep seconds left: {timeLeft}s</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={handleSkipPrep}>
              <Text style={styles.primaryButtonText}>Skip Prep & Record</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.footerInfo}>
            <Text style={[styles.timerSubText, styles.recordingText]}>
              Recording: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")} left
            </Text>
            <TouchableOpacity style={[styles.primaryButton, styles.stopButton]} onPress={handleStopAndSubmit}>
              <Text style={styles.primaryButtonText}>Stop & Review Answer</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  header: {
    flexDirection: "row",
    justifyContent: "between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  progressText: {
    fontSize: 14,
    color: "#94A3B8",
    fontWeight: "600",
    flex: 1,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  badgeThink: {
    backgroundColor: "#F59E0B",
  },
  badgeRecord: {
    backgroundColor: "#EF4444",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  questionCard: {
    backgroundColor: "#1E293B",
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  questionText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#F8FAFC",
    lineHeight: 22,
  },
  cameraContainer: {
    flex: 1,
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#334155",
    position: "relative",
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  countdownTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 1.5,
  },
  countdownNumber: {
    fontSize: 72,
    fontWeight: "800",
    color: "#F59E0B",
    marginVertical: 12,
  },
  countdownSub: {
    fontSize: 14,
    color: "#64748B",
  },
  controls: {
    padding: 20,
    paddingBottom: 24,
  },
  footerInfo: {
    alignItems: "center",
  },
  timerSubText: {
    fontSize: 14,
    color: "#94A3B8",
    fontWeight: "600",
    marginBottom: 16,
  },
  recordingText: {
    color: "#EF4444",
  },
  primaryButton: {
    width: "100%",
    backgroundColor: "#2563EB",
    borderRadius: 12,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  stopButton: {
    backgroundColor: "#DC2626",
  },
  primaryButtonText: {
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
    color: "#94A3B8",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: "#334155",
    borderRadius: 8,
  },
  backButtonText: {
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: "600",
  },
});
