"use client";

import * as React from "react";
import { CheckIcon, RotateCcwIcon } from "lucide-react";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { cn } from "@workspace/ui/lib/utils";

import {
  resolveThemePalette,
  THEME_PICKER_DEFAULTS,
  THEME_PRESET_OPTIONS,
  type ThemePresetId,
} from "@/lib/themes";

type ThemeCustomizerProps = {
  preset: ThemePresetId;
  customLightPrimary: string;
  customDarkPrimary: string;
  customLightAccent: string;
  customDarkAccent: string;
  onPresetChange: (preset: ThemePresetId) => void;
  onCustomLightPrimaryChange: (value: string) => void;
  onCustomDarkPrimaryChange: (value: string) => void;
  onCustomLightAccentChange: (value: string) => void;
  onCustomDarkAccentChange: (value: string) => void;
  className?: string;
};

const SWATCH_SETS = {
  lightPrimary: ["#111827", "#2563eb", "#0f766e", "#7c3aed", "#db2777", "#f97316"],
  darkPrimary: ["#f4f4f5", "#7dd3fc", "#86efac", "#c4b5fd", "#f9a8d4", "#fdba74"],
  lightAccent: ["#f5f5f5", "#eff6ff", "#ecfdf5", "#f5f3ff", "#fdf2f8", "#fff7ed"],
  darkAccent: ["#27272a", "#1e3a5f", "#1f3b2b", "#312e81", "#4a2033", "#4a2c1a"],
} as const;

function isHexColor(value: string) {
  return /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(value.trim());
}

function normalizeHexColor(value: string) {
  const trimmed = value.trim();
  if (!isHexColor(trimmed)) return null;
  if (trimmed.length === 4) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase();
  }
  return trimmed.toLowerCase();
}

function getPresetSwatches(preset: ThemePresetId) {
  if (preset === "custom") {
    return THEME_PICKER_DEFAULTS.presets.default;
  }
  return THEME_PICKER_DEFAULTS.presets[preset];
}

function SwatchButton({
  color,
  active,
  onClick,
}: {
  color: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Select ${color}`}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "relative size-7 rounded-md border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        active ? "border-foreground/40 shadow-sm" : "border-border hover:border-foreground/30"
      )}
      style={{ backgroundColor: color }}
    >
      {active ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <CheckIcon className="size-3.5 text-white mix-blend-difference" />
        </span>
      ) : null}
    </button>
  );
}

function ThemePreview({
  label,
  vars,
}: {
  label: string;
  vars: Record<string, string>;
}) {
  return (
    <div
      className="overflow-hidden rounded-lg border border-border"
      style={vars as React.CSSProperties}
    >
      <div className="border-b border-border bg-background px-3 py-2 text-xs font-medium text-foreground">
        {label}
      </div>
      <div className="grid grid-cols-[72px_minmax(0,1fr)] bg-background">
        <div className="border-r border-border p-3" style={{ background: "var(--accent)" }}>
          <div className="mb-3 flex items-center gap-2">
            <div className="size-7 rounded-md" style={{ background: "var(--primary)" }} />
            <div className="min-w-0">
              <div className="h-2.5 w-10 rounded-full bg-foreground/15" />
              <div className="mt-1 h-2 w-7 rounded-full bg-foreground/10" />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="h-7 rounded-md bg-background/75" />
            <div className="h-7 rounded-md bg-background/55" />
            <div className="h-7 rounded-md bg-background/55" />
          </div>
        </div>
        <div className="p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="h-2.5 w-18 rounded-full bg-foreground/15" />
              <div className="mt-1 h-2 w-24 rounded-full bg-foreground/10" />
            </div>
            <div className="rounded-md px-2 py-1 text-xs font-medium" style={{ background: "var(--accent)", color: "var(--foreground)" }}>
              Accent
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-border bg-card p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="h-2.5 w-20 rounded-full bg-foreground/15" />
                <div className="h-2 w-28 rounded-full bg-foreground/10" />
              </div>
              <div className="rounded-md px-3 py-1.5 text-xs font-medium" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
                Button
              </div>
            </div>
            <div className="mt-3 h-2 rounded-full bg-muted">
              <div className="h-2 w-2/3 rounded-full" style={{ background: "var(--primary)" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorField({
  id,
  label,
  value,
  fallbackHex,
  swatches,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  fallbackHex: string;
  swatches: readonly string[];
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const normalizedValue = normalizeHexColor(value);
  const currentColor = value.trim() || fallbackHex;
  const normalizedCurrent = normalizeHexColor(currentColor) ?? fallbackHex;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        <button
          type="button"
          onClick={() => onChange("")}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
        >
          <RotateCcwIcon className="size-3.5" />
          Reset
        </button>
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/25 px-2 py-1.5">
            <span className="text-[11px] text-muted-foreground">Current</span>
            <span
              className="size-4 rounded-sm border border-black/10"
              style={{ backgroundColor: currentColor }}
            />
            <span className="max-w-24 truncate font-mono text-[11px] text-muted-foreground">
              {value.trim() || "Default"}
            </span>
          </div>
          {swatches.map((swatch) => (
            <SwatchButton
              key={swatch}
              color={swatch}
              active={normalizedValue === swatch || (!value.trim() && normalizedCurrent === swatch)}
              onClick={() => onChange(swatch)}
            />
          ))}
        </div>
        <Input
          id={id}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="font-mono text-xs"
        />
      </div>
    </div>
  );
}

export function ThemeCustomizer({
  preset,
  customLightPrimary,
  customDarkPrimary,
  customLightAccent,
  customDarkAccent,
  onPresetChange,
  onCustomLightPrimaryChange,
  onCustomDarkPrimaryChange,
  onCustomLightAccentChange,
  onCustomDarkAccentChange,
  className,
}: ThemeCustomizerProps) {
  const palette = resolveThemePalette({
    preset,
    customLightPrimary: customLightPrimary.trim(),
    customDarkPrimary: customDarkPrimary.trim(),
    customLightAccent: customLightAccent.trim(),
    customDarkAccent: customDarkAccent.trim(),
  });

  const presetSwatches = getPresetSwatches(preset);

  return (
    <div className={cn("space-y-6", className)}>
      <div className="space-y-3">
        <Label>Preset</Label>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {THEME_PRESET_OPTIONS.map((option) => {
            const optionSwatches = getPresetSwatches(option.id);
            const selected = preset === option.id;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onPresetChange(option.id)}
                className={cn(
                  "relative rounded-lg border p-3 text-left transition",
                  selected
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-primary/40 hover:bg-accent/40"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{option.label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {option.id === "custom" ? "Fine tune every surface" : "Balanced preset colors"}
                    </div>
                  </div>
                  {selected ? <CheckIcon className="size-4 text-primary" /> : null}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground">
                    <span className="size-3 rounded-full border border-black/10" style={{ backgroundColor: optionSwatches.lightPrimary }} />
                    <span className="size-3 rounded-full border border-black/10" style={{ backgroundColor: optionSwatches.lightAccent }} />
                    Light
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground">
                    <span className="size-3 rounded-full border border-white/10" style={{ backgroundColor: optionSwatches.darkPrimary }} />
                    <span className="size-3 rounded-full border border-white/10" style={{ backgroundColor: optionSwatches.darkAccent }} />
                    Dark
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ThemePreview label="Light preview" vars={palette.light} />
        <ThemePreview label="Dark preview" vars={palette.dark} />
      </div>

      {preset === "custom" ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-border p-4">
              <div className="text-sm font-medium">Light mode</div>
              <div className="mt-4 space-y-4">
                <ColorField
                  id="theme-custom-light-primary"
                  label="Primary"
                  value={customLightPrimary}
                  fallbackHex={presetSwatches.lightPrimary}
                  swatches={SWATCH_SETS.lightPrimary}
                  placeholder="#2563eb or oklch(...)"
                  onChange={onCustomLightPrimaryChange}
                />
                <ColorField
                  id="theme-custom-light-accent"
                  label="Accent"
                  value={customLightAccent}
                  fallbackHex={presetSwatches.lightAccent}
                  swatches={SWATCH_SETS.lightAccent}
                  placeholder="#eff6ff or oklch(...)"
                  onChange={onCustomLightAccentChange}
                />
              </div>
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="text-sm font-medium">Dark mode</div>
              <div className="mt-4 space-y-4">
                <ColorField
                  id="theme-custom-dark-primary"
                  label="Primary"
                  value={customDarkPrimary}
                  fallbackHex={presetSwatches.darkPrimary}
                  swatches={SWATCH_SETS.darkPrimary}
                  placeholder="#7dd3fc or oklch(...)"
                  onChange={onCustomDarkPrimaryChange}
                />
                <ColorField
                  id="theme-custom-dark-accent"
                  label="Accent"
                  value={customDarkAccent}
                  fallbackHex={presetSwatches.darkAccent}
                  swatches={SWATCH_SETS.darkAccent}
                  placeholder="#1e3a5f or oklch(...)"
                  onChange={onCustomDarkAccentChange}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <span>Pick a swatch for quick changes.</span>
            <span>You can still paste advanced values like <code>oklch(0.57 0.18 245)</code>.</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onCustomLightPrimaryChange("");
                onCustomDarkPrimaryChange("");
                onCustomLightAccentChange("");
                onCustomDarkAccentChange("");
              }}
            >
              <RotateCcwIcon className="size-4" />
              Clear custom colors
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
