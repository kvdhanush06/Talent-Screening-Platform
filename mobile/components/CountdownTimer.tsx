import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";

interface CountdownTimerProps {
  seconds: number;
  onTimeUp: () => void;
  warningThreshold?: number;
  isActive: boolean;
}

export default function CountdownTimer({
  seconds,
  onTimeUp,
  warningThreshold = 15,
  isActive,
}: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(seconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTimeUpRef = useRef(onTimeUp);

  onTimeUpRef.current = onTimeUp;

  useEffect(() => {
    setRemaining(seconds);
  }, [seconds]);

  useEffect(() => {
    if (!isActive) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          onTimeUpRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive]);

  const minutes = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const formatted = `${minutes}:${secs.toString().padStart(2, "0")}`;

  const isWarning = remaining <= warningThreshold && remaining > 0;
  const isCritical = remaining <= 5 && remaining > 0;

  return (
    <View
      style={[
        styles.container,
        isCritical && styles.containerCritical,
        isWarning && !isCritical && styles.containerWarning,
      ]}
    >
      <Text
        style={[
          styles.label,
          isCritical && styles.labelCritical,
          isWarning && !isCritical && styles.labelWarning,
        ]}
      >
        {isCritical ? "HURRY!" : isWarning ? "Almost out of time" : "Time remaining"}
      </Text>
      <Text
        style={[
          styles.timer,
          isCritical && styles.timerCritical,
          isWarning && !isCritical && styles.timerWarning,
        ]}
      >
        {formatted}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#EFF6FF",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  containerWarning: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
  },
  containerCritical: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#2563EB",
  },
  labelWarning: {
    color: "#D97706",
  },
  labelCritical: {
    color: "#DC2626",
    fontWeight: "700",
  },
  timer: {
    fontSize: 24,
    fontWeight: "700",
    color: "#2563EB",
    fontVariant: ["tabular-nums"],
  },
  timerWarning: {
    color: "#D97706",
  },
  timerCritical: {
    color: "#DC2626",
  },
});
