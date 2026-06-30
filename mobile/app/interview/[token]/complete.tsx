import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { interviewService } from "@/services/interviewService";
import LoadingScreen from "@/components/LoadingScreen";
import storage from "@/lib/storage";
import { getErrorMessage } from "@/lib/api";

export default function CompleteInterviewScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function finalize() {
      if (!token) return;
      try {
        await interviewService.completeInterview(token);
      } catch (err) {
        // Log the error but still let the candidate know they finished recording
        console.error("Failed to finalize complete status on server:", err);
      } finally {
        setLoading(false);
      }
    }
    finalize();
  }, [token]);

  const handleExit = async () => {
    await storage.clearAll();
    router.replace("/");
  };

  if (loading) {
    return <LoadingScreen message="Finalizing interview submission..." />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.successIconContainer}>
          <Text style={styles.checkmark}>✓</Text>
        </View>

        <Text style={styles.title}>Interview Completed!</Text>
        <Text style={styles.description}>
          Thank you for taking the time to record your responses. Your video files have been safely uploaded.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardHeader}>What happens next?</Text>
          <Text style={styles.cardText}>
            Our AI engine is currently generating your transcript and compiling a semantic scorecard for the recruiting team.
          </Text>
          <Text style={styles.cardText}>
            You will be contacted by email once the hiring manager reviews your application.
          </Text>
        </View>

        <TouchableOpacity style={styles.exitButton} onPress={handleExit}>
          <Text style={styles.exitButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#DCFCE7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  checkmark: {
    fontSize: 40,
    color: "#16A34A",
    fontWeight: "700",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1E293B",
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
    maxWidth: 300,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    width: "100%",
    marginBottom: 40,
  },
  cardHeader: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 12,
  },
  cardText: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
    marginBottom: 10,
  },
  exitButton: {
    width: "100%",
    backgroundColor: "#2563EB",
    borderRadius: 12,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  exitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
