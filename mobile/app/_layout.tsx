import React from "react";
import { Stack } from "expo-router";
import { AuthProvider } from "@/contexts/AuthContext";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: "#2563EB",
          },
          headerTintColor: "#fff",
          headerTitleStyle: {
            fontWeight: "bold",
          },
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" options={{ title: "Welcome" }} />
        <Stack.Screen name="interview/[token]/index" options={{ title: "Introduction" }} />
        <Stack.Screen name="interview/[token]/question" options={{ title: "Record Response" }} />
        <Stack.Screen name="interview/[token]/review" options={{ title: "Review Answers" }} />
        <Stack.Screen name="interview/[token]/complete" options={{ title: "Completed" }} />
      </Stack>
    </AuthProvider>
  );
}
