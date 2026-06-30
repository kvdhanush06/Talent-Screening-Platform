import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface ProgressBarProps {
  current: number;
  total: number;
  labels?: string[];
}

export default function ProgressBar({
  current,
  total,
  labels,
}: ProgressBarProps) {
  const progress = total > 0 ? current / total : 0;
  const percentage = Math.round(progress * 100);

  return (
    <View style={styles.container}>
      <View style={styles.info}>
        <Text style={styles.label}>
          {labels
            ? labels[current - 1] || `Step ${current} of ${total}`
            : `Question ${current} of ${total}`}
        </Text>
        <Text style={styles.percentage}>{percentage}%</Text>
      </View>
      <View style={styles.barOuter}>
        <View style={[styles.barInner, { width: `${percentage}%` }]} />
      </View>
      {total > 1 && (
        <View style={styles.dots}>
          {Array.from({ length: total }, (_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i < current && styles.dotActive,
                i === current - 1 && styles.dotCurrent,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  info: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
  },
  percentage: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2563EB",
  },
  barOuter: {
    height: 6,
    backgroundColor: "#E2E8F0",
    borderRadius: 3,
    overflow: "hidden",
  },
  barInner: {
    height: "100%",
    backgroundColor: "#2563EB",
    borderRadius: 3,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#E2E8F0",
  },
  dotActive: {
    backgroundColor: "#2563EB",
  },
  dotCurrent: {
    backgroundColor: "#2563EB",
    transform: [{ scale: 1.3 }],
  },
});
