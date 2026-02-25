// CRITICAL
"use client";

import type { CSSProperties, ReactNode } from "react";
import { resolveUiToneConfig } from "./configs";
import type { UiTone } from "./types";

function joinClassNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

interface UiPanelSurfaceProps {
  children: ReactNode;
  className?: string;
}

export function UiPanelSurface({ children, className }: UiPanelSurfaceProps) {
  return (
    <div
      className={joinClassNames("rounded-lg border border-(--border) bg-(--surface)", className)}
    >
      {children}
    </div>
  );
}

interface UiInsetSurfaceProps {
  children: ReactNode;
  className?: string;
}

export function UiInsetSurface({ children, className }: UiInsetSurfaceProps) {
  return (
    <div className={joinClassNames("rounded-lg border border-(--border) bg-(--bg) p-4", className)}>
      {children}
    </div>
  );
}

interface UiModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  maxWidth?: string;
}

export function UiModal({
  isOpen,
  onClose,
  children,
  className,
  maxWidth = "max-w-lg",
}: UiModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        className="absolute inset-0 z-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />
      <div
        className={joinClassNames(
          "relative z-10 w-full border border-(--border) bg-(--surface) rounded-xl shadow-xl",
          maxWidth,
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

interface UiModalHeaderProps {
  title: string;
  icon?: ReactNode;
  onClose?: () => void;
  actions?: ReactNode;
  closeLabel?: string;
  className?: string;
  showCloseButton?: boolean;
  closeIcon?: ReactNode;
}

export function UiModalHeader({
  title,
  icon,
  onClose,
  actions,
  closeLabel = "Close",
  className,
  showCloseButton = true,
  closeIcon,
}: UiModalHeaderProps) {
  return (
    <div
      className={joinClassNames(
        "flex items-center justify-between px-6 py-4 border-b border-(--border)",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="flex items-center gap-2">
        {actions}
        {showCloseButton && onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-(--accent)"
            aria-label={closeLabel}
          >
            {closeIcon ?? "×"}
          </button>
        )}
      </div>
    </div>
  );
}

interface UiStatusBadgeProps {
  children: ReactNode;
  tone?: UiTone;
  className?: string;
  style?: CSSProperties;
}

export function UiStatusBadge({
  children,
  tone = "neutral",
  className,
  style,
}: UiStatusBadgeProps) {
  const toneConfig = resolveUiToneConfig(tone);
  const toneStyle: CSSProperties = {
    color: `var(${toneConfig.dotVar})`,
    backgroundColor: `color-mix(in srgb, var(${toneConfig.dotVar}) 12%, transparent)`,
  };

  return (
    <span
      className={joinClassNames("text-[9px] px-1.5 py-0.5 rounded-full", className)}
      style={{ ...toneStyle, ...(style ?? {}) }}
    >
      {children}
    </span>
  );
}

interface UiTimelineMarkerProps {
  tone?: UiTone;
  pulsing?: boolean;
  showDot?: boolean;
  className?: string;
  innerClassName?: string;
  children?: ReactNode;
}

export function UiTimelineMarker({
  tone = "neutral",
  pulsing = false,
  showDot = true,
  className,
  innerClassName,
  children,
}: UiTimelineMarkerProps) {
  const toneConfig = resolveUiToneConfig(tone);
  const markerStyle: CSSProperties = {
    borderColor: `var(${toneConfig.borderVar})`,
    backgroundColor: "var(--surface)",
  };

  if (children) {
    return (
      <div
        className={joinClassNames(
          "rounded-full border flex items-center justify-center",
          className,
        )}
        style={markerStyle}
      >
        {children}
      </div>
    );
  }

  const dotStyle: CSSProperties = {
    backgroundColor: `var(${toneConfig.dotVar})`,
  };

  return (
    <div
      className={joinClassNames("rounded-full border flex items-center justify-center", className)}
      style={markerStyle}
    >
      {showDot && (
        <div
          className={joinClassNames(
            "rounded-full",
            pulsing && "animate-pulse",
            innerClassName || "w-1 h-1",
          )}
          style={dotStyle}
        />
      )}
    </div>
  );
}

interface UiStatusPillProps {
  children: ReactNode;
  tone?: UiTone;
  className?: string;
  style?: CSSProperties;
}

export function UiStatusPill({ children, tone = "neutral", className, style }: UiStatusPillProps) {
  const toneConfig = resolveUiToneConfig(tone);
  const toneStyle: CSSProperties = {
    borderColor: `color-mix(in srgb, var(${toneConfig.dotVar}) 35%, transparent)`,
    backgroundColor: `color-mix(in srgb, var(${toneConfig.dotVar}) 12%, transparent)`,
    color: `var(${toneConfig.dotVar})`,
  };

  return (
    <span
      className={joinClassNames(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none",
        className,
      )}
      style={{ ...toneStyle, ...(style ?? {}) }}
    >
      {children}
    </span>
  );
}

interface UiMetricTileProps {
  label: string;
  value: string;
  unit: string;
  tone?: UiTone;
  className?: string;
  footnote?: string;
  isLive?: boolean;
}

export function UiMetricTile({
  label,
  value,
  unit,
  tone = "neutral",
  className,
  footnote,
  isLive,
}: UiMetricTileProps) {
  const toneConfig = resolveUiToneConfig(tone);
  return (
    <div className={joinClassNames("bg-background p-4", className)}>
      <div className="text-[10px] uppercase tracking-widest text-foreground/30 mb-1 flex items-center gap-1.5">
        {label}
        {isLive && (
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: `var(${toneConfig.dotVar})` }}
          />
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className={joinClassNames(
            "text-2xl font-light tabular-nums transition-colors duration-300",
            tone !== "neutral" ? toneConfig.textClass : "",
          )}
        >
          {value}
        </span>
        <span className="text-xs text-foreground/30">{unit}</span>
      </div>
      {footnote && <div className="text-[10px] text-foreground/20 mt-1 font-mono">{footnote}</div>}
    </div>
  );
}

interface UiPulseLabelProps {
  children: ReactNode;
  tone?: UiTone;
  className?: string;
}

export function UiPulseLabel({ children, tone = "info", className }: UiPulseLabelProps) {
  const toneConfig = resolveUiToneConfig(tone);
  return (
    <span
      className={joinClassNames("animate-pulse", toneConfig.textClass, className)}
      style={{
        textShadow: `0 0 12px color-mix(in srgb, var(${toneConfig.dotVar}) 40%, transparent)`,
      }}
    >
      {children}
    </span>
  );
}
