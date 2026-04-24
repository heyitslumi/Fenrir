"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"

import { api } from "@/lib/api"
import { buildThemeCss, normalizePreset, resolveThemePalette } from "@/lib/themes"

const THEME_STYLE_ID = "fenrir-theme-vars"
const USER_THEME_STORAGE_KEY = "fenrir.userTheme"

function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      <ThemeHotkey />
      <ThemePaletteController />
      {children}
    </NextThemesProvider>
  )
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  )
}

function ThemePaletteController() {
  React.useEffect(() => {
    let mounted = true

    const applyTheme = async () => {
      try {
        const brand = await api.settings.getBrand()
        if (!mounted) return

        const userRaw = window.localStorage.getItem(USER_THEME_STORAGE_KEY)
        let userConfig: Record<string, string> | null = null
        if (userRaw) {
          try {
            userConfig = JSON.parse(userRaw)
          } catch {
            userConfig = null
          }
        }

        const preset = normalizePreset(userConfig?.preset || brand["theme.defaultPreset"])
        const palette = resolveThemePalette({
          preset,
          customLightPrimary: userConfig?.customLightPrimary || brand["theme.custom.light.primary"],
          customDarkPrimary: userConfig?.customDarkPrimary || brand["theme.custom.dark.primary"],
          customLightAccent: userConfig?.customLightAccent || brand["theme.custom.light.accent"],
          customDarkAccent: userConfig?.customDarkAccent || brand["theme.custom.dark.accent"],
        })

        let styleTag = document.getElementById(THEME_STYLE_ID) as HTMLStyleElement | null
        if (!styleTag) {
          styleTag = document.createElement("style")
          styleTag.id = THEME_STYLE_ID
          document.head.appendChild(styleTag)
        }

        styleTag.textContent = buildThemeCss(palette)
      } catch {
        // Keep built-in CSS defaults if dynamic theme fetch fails.
      }
    }

    void applyTheme()

    const handleChange = () => {
      void applyTheme()
    }

    window.addEventListener("storage", handleChange)
    window.addEventListener("fenrir-theme-change", handleChange)

    return () => {
      mounted = false
      window.removeEventListener("storage", handleChange)
      window.removeEventListener("fenrir-theme-change", handleChange)
    }
  }, [])

  return null
}

function ThemeHotkey() {
  const { resolvedTheme, setTheme } = useTheme()

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) {
        return
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      if (event.key?.toLowerCase() !== "d") {
        return
      }

      if (isTypingTarget(event.target)) {
        return
      }

      setTheme(resolvedTheme === "dark" ? "light" : "dark")
    }

    window.addEventListener("keydown", onKeyDown)

    return () => {
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [resolvedTheme, setTheme])

  return null
}

export { ThemeProvider }
