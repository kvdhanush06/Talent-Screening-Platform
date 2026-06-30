import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from "react-native";

interface UploadItem {
  questionId: string;
  questionText: string;
  progress: number;
  status: "pending" | "uploading" | "completed" | "error";
  error?: string;
}

interface UploadProgressProps {
  items: UploadItem[];
  overallProgress?: number;
}

export default function UploadProgress({
  items,
  overallProgress,
}: UploadProgressProps) {
  const completed = items.filter((i) => i.status === "completed").length;
  const hasError = items.some((i) => i.status === "error");
  const allDone = items.every((i) => i.status === "completed");
  const avgProgress =
    overallProgress ??
    (items.length > 0
      ? Math.round(
          items.reduce((sum, i) => sum + i.progress, 0) / items.length
        )
      : 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {allDone
            ? "All answers uploaded"
            : hasError
            ? "Upload paused"
            : "Uploading answers..."}
        </Text>
        <Text style={styles.count}>
          {completed} of {items.length}
        </Text>
      </View>

      {!allDone && (
        <View style={styles.overallBarOuter}>
          <View
            style={[
              styles.overallBarInner,
              { width: `${avgProgress}%` },
              hasError && styles.overallBarError,
            ]}
          />
        </View>
      )}

      <View style={styles.itemsList}>
        {items.map((item) => (
          <View key={item.questionId} style={styles.item}>
            <View style={styles.itemHeader}>
              <View style={styles.itemInfo}>
                {item.status === "uploading" && (
                  <ActivityIndicator
                    size="small"
                    color="#2563EB"
                    style={styles.spinner}
                  />
                )}
                {item.status === "completed" && (
                  <Text style={styles.iconComplete}>OK</Text>
                )}
                {item.status === "error" && (
                  <Text style={styles.iconError}>X</Text>
                )}
                {item.status === "pending" && (
                  <View style={styles.pendingDot} />
                )}
                <Text
                  style={[
                    styles.itemText,
                    item.status === "completed" && styles.itemTextDone,
                    item.status === "error" && styles.itemTextError,
                  ]}
                  numberOfLines={1}
                >
                  {item.questionText}
                </Text>
              </View>
              <Text style={styles.itemProgress}>
                {item.status === "completed"
                  ? "100%"
                  : item.status === "error"
                  ? "Failed"
                  : `${item.progress}%`}
              </Text>
            </View>
            {item.status === "uploading" && (
              <View style={styles.itemBarOuter}>
                <View
                  style={[
                    styles.itemBarInner,
                    { width: `${item.progress}%` },
                  ]}
                />
              </View>
            )}
            {item.status === "error" && item.error && (
              <Text style={styles.errorText}>{item.error}</Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E293B",
  },
  count: {
    fontSize: 14,
    fontWeight: "500",
    color: "#64748B",
  },
  overallBarOuter: {
    height: 8,
    backgroundColor: "#E2E8F0",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 16,
  },
  overallBarInner: {
    height: "100%",
    backgroundColor: "#2563EB",
    borderRadius: 4,
  },
  overallBarError: {
    backgroundColor: "#F59E0B",
  },
  itemsList: {
    gap: 12,
  },
  item: {
    gap: 6,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 8,
    marginRight: 12,
  },
  spinner: {
    width: 16,
    height: 16,
  },
  iconComplete: {
    fontSize: 10,
    fontWeight: "800",
    color: "#16A34A",
    backgroundColor: "#DCFCE7",
    width: 18,
    height: 18,
    borderRadius: 9,
    textAlign: "center",
    lineHeight: 18,
    overflow: "hidden",
  },
  iconError: {
    fontSize: 10,
    fontWeight: "800",
    color: "#DC2626",
    backgroundColor: "#FEE2E2",
    width: 18,
    height: 18,
    borderRadius: 9,
    textAlign: "center",
    lineHeight: 18,
    overflow: "hidden",
  },
  pendingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#CBD5E1",
  },
  itemText: {
    fontSize: 14,
    color: "#1E293B",
    flex: 1,
  },
  itemTextDone: {
    color: "#16A34A",
    textDecorationLine: "line-through",
  },
  itemTextError: {
    color: "#DC2626",
  },
  itemProgress: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  itemBarOuter: {
    height: 4,
    backgroundColor: "#E2E8F0",
    borderRadius: 2,
    overflow: "hidden",
  },
  itemBarInner: {
    height: "100%",
    backgroundColor: "#2563EB",
    borderRadius: 2,
  },
  errorText: {
    fontSize: 12,
    color: "#DC2626",
    marginTop: 2,
  },
});
