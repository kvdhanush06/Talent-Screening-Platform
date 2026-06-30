import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { interviewApi, getErrorMessage } from "@/lib/api";
import storage from "@/lib/storage";

export default function TokenEntryScreen() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!token.trim()) {
      setError("Please enter your interview invitation token.");
      return;
    }

    const cleanToken = token.trim();
    setLoading(true);
    setError(null);

    try {
      // Validate token on backend
      const details = await interviewApi.getInterviewDetails(cleanToken);
      
      // Store token locally
      await storage.setToken(cleanToken);
      
      // Navigate to interview intro screen
      router.push(`/interview/${cleanToken}`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.appName}>Talent Screen</Text>
          <Text style={styles.tagline}>Async Video Interview Platform</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Enter Invitation Token</Text>
          <Text style={styles.cardDescription}>
            Please paste the 16-character invitation token from the email you received to access your scheduled interview.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="e.g. 8f7e2a9b4c6d8e0f"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={32}
            value={token}
            onChangeText={(text) => {
              setToken(text);
              if (error) setError(null);
            }}
          />

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Access Interview</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Make sure you are in a quiet room with a stable internet connection.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  appName: {
    fontSize: 28,
    fontWeight: "800",
    color: "#2563EB",
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 4,
    fontWeight: "500",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: "#64748B",
    lineHeight: 20,
    marginBottom: 24,
  },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#1E293B",
    marginBottom: 16,
    backgroundColor: "#F8FAFC",
  },
  errorText: {
    fontSize: 14,
    color: "#DC2626",
    fontWeight: "500",
    marginBottom: 16,
  },
  button: {
    height: 52,
    backgroundColor: "#2563EB",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonDisabled: {
    backgroundColor: "#93C5FD",
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    alignItems: "center",
    marginTop: 32,
  },
  footerText: {
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 240,
  },
});
