import React from "react";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";

interface LoadingScreenProps {
  message?: string;
  fullScreen?: boolean;
}

export default function LoadingScreen({
  message = "Loading...",
  fullScreen = true,
}: LoadingScreenProps) {
  if (!fullScreen) {
    return (
      <View style={styles.inline}>
        <ActivityIndicator size="large" color="#2563EB" />
        {message ? <Text style={styles.inlineText}>{message}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.text}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  content: {
    alignItems: "center",
    gap: 16,
  },
  text: {
    fontSize: 16,
    color: "#64748B",
    textAlign: "center",
  },
  inline: {
    padding: 32,
    alignItems: "center",
    gap: 12,
  },
  inlineText: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
  },
});
