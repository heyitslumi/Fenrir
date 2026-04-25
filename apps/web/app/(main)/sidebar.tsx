"use client"

import * as React from "react"

import {
  Sidebar as RawSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  LayoutDashboardIcon,
  ServerIcon,
  StoreIcon,
  UserIcon,
  ShieldIcon,
  SettingsIcon,
  LogOutIcon,
  CoinsIcon,
  SearchIcon,
  LockIcon,
  ClockIcon,
  PackageIcon,
  MapPinIcon,
  EggIcon,
  RefreshCwIcon,
  UsersIcon,
  KeyIcon,
  ChevronRightIcon,
  MoonIcon,
  SunIcon,
  type LucideIcon,
} from "lucide-react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { useTheme } from "next-themes"
import AuthenticationContext from "@/app/_context/authentication"
import { api, type BrandConfig } from "@/lib/api"
import { getAccessToken } from "@/lib/auth"
import { cachedFetch } from "@/lib/cache"
import { Separator } from "@workspace/ui/components/separator"
import { Input } from "@workspace/ui/components/input"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"

type NavItem = {
  title: string
  url: string
  icon: LucideIcon
  permission?: string
}

function getInitials(source: string | undefined | null): string {
  if (!source || !source.trim()) return "U"
  return source.trim().charAt(0).toUpperCase()
}

const navMain: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboardIcon },
  { title: "Servers", url: "/servers", icon: ServerIcon },
  { title: "Profile", url: "/profile", icon: UserIcon },
  { title: "Store", url: "/store", icon: StoreIcon },
  { title: "AFK", url: "/afk", icon: ClockIcon },
]

const navAdmin: NavItem[] = [
  { title: "Admin", url: "/admin", icon: ShieldIcon, permission: "users.read" },
  {
    title: "Users",
    url: "/admin/users",
    icon: UsersIcon,
    permission: "users.read",
  },
  {
    title: "Servers",
    url: "/admin/servers",
    icon: ServerIcon,
    permission: "servers.read",
  },
  {
    title: "Roles",
    url: "/admin/roles",
    icon: KeyIcon,
    permission: "roles.read",
  },
  { title: "Eggs", url: "/admin/eggs", icon: EggIcon, permission: "eggs.read" },
  {
    title: "Locations",
    url: "/admin/locations",
    icon: MapPinIcon,
    permission: "settings.read",
  },
  {
    title: "Packages",
    url: "/admin/packages",
    icon: PackageIcon,
    permission: "packages.read",
  },
  {
    title: "Sync",
    url: "/admin/sync",
    icon: RefreshCwIcon,
    permission: "settings.write",
  },
  {
    title: "Settings",
    url: "/admin/settings",
    icon: SettingsIcon,
    permission: "settings.read",
  },
]

export default function Sidebar({
  ...props
}: React.ComponentProps<typeof RawSidebar>) {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()
  const [brand, setBrand] = React.useState<BrandConfig>({})

  React.useEffect(() => {
    if (isMobile) setOpenMobile(false)
  }, [pathname, isMobile, setOpenMobile])

  React.useEffect(() => {
    cachedFetch("brand", () => api.settings.getBrand(), 5 * 60 * 1000)
      .then(setBrand)
      .catch(() => {})
  }, [])

  return (
    <RawSidebar collapsible="icon" {...props}>
      <SidebarHeader className="px-4 pt-5 pb-0 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:pt-4 group-data-[collapsible=icon]:pb-0">
        <BrandHeader brand={brand} />
      </SidebarHeader>

      {/* Expanded: user card + search */}
      <div className="flex flex-col gap-3 px-4 py-3 group-data-[collapsible=icon]:hidden">
        <UserCard />
        <SearchBar />
      </div>

      {/* Collapsed: avatar only */}
      <div className="hidden py-3 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center">
        <CollapsedAvatar />
      </div>

      <SidebarContent className="px-3 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
        <SidebarGroup className="py-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5 group-data-[collapsible=icon]:gap-1">
              {navMain.map((item) => (
                <NavLink key={item.url} item={item} pathname={pathname} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <AdminSection pathname={pathname} />
      </SidebarContent>

      <SidebarFooter className="px-4 pt-0 pb-4 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:pb-4">
        <FooterBar />
      </SidebarFooter>
    </RawSidebar>
  )
}

function BrandHeader({ brand }: { brand: BrandConfig }) {
  const logo = brand["panel.logo"]
  const name = brand["panel.name"]
  const logoHeight = parseInt(brand["panel.logoHeight"] || "32", 10)
  const showName = name || !logo

  return (
    <>
      {/* Expanded */}
      <div className="group-data-[collapsible=icon]:hidden">
        <div className="flex items-center gap-2.5">
          {logo && (
            <Image
              src={logo}
              alt={name || "Logo"}
              width={32}
              height={32}
              className="size-8 shrink-0 object-contain"
              unoptimized
            />
          )}
          {showName && (
            <h1 className="truncate text-base font-bold tracking-tight">
              {name || "Panel"}
            </h1>
          )}
        </div>
      </div>
      {/* Collapsed */}
      <div className="hidden group-data-[collapsible=icon]:block">
        {logo ? (
          <Image
            src={logo}
            alt={name || "Logo"}
            width={24}
            height={24}
            className="size-6 object-contain"
            unoptimized
          />
        ) : (
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            {(name || "P").charAt(0)}
          </div>
        )}
      </div>
    </>
  )
}

function getAvatarUrl(avatar: string | null | undefined) {
  if (!avatar) return null
  if (avatar.startsWith("http")) return avatar
  const base = (
    typeof window !== "undefined"
      ? (window as any).__ENV__?.NEXT_PUBLIC_API_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        "http://localhost:3001/api"
      : process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"
  ).replace(/\/api$/, "")
  return `${base}${avatar}`
}

function CollapsedAvatar() {
  const { user, isLoading } = React.use(AuthenticationContext)
  const { logout } = React.use(AuthenticationContext)
  const { resolvedTheme, setTheme } = useTheme()
  const src = getAvatarUrl(user?.avatar)
  const isDark = resolvedTheme === "dark"

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex size-8 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-80"
              >
                {src ? (
                  <img src={src} alt="Avatar" className="size-full object-cover" />
                ) : isLoading ? (
                  "·"
                ) : (
                  getInitials(user?.name || user?.email)
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="center" className="w-56">
              <DropdownMenuLabel>{user?.name || "Account"}</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href="/profile">
                  <UserIcon className="size-4" />
                  <span>Profile</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("light")}>
                <SunIcon className="size-4" />
                <span>Light mode</span>
                {!isDark ? <span className="ml-auto text-xs text-muted-foreground">Active</span> : null}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                <MoonIcon className="size-4" />
                <span>Dark mode</span>
                {isDark ? <span className="ml-auto text-xs text-muted-foreground">Active</span> : null}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => logout()}>
                <LogOutIcon className="size-4" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right">{user?.name || "Profile"}</TooltipContent>
    </Tooltip>
  )
}

function UserCard() {
  const { user, isLoading, logout } = React.use(AuthenticationContext)
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="group/user flex w-full items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
        >
          <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-sm font-semibold text-white shadow-sm">
            {getAvatarUrl(user?.avatar) ? (
              <img
                src={getAvatarUrl(user?.avatar)!}
                alt="Avatar"
                className="size-full object-cover"
              />
            ) : isLoading ? (
              "·"
            ) : (
              getInitials(user?.name || user?.email)
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm leading-tight font-medium">
              {user?.name || "User"}
            </p>
            <p className="truncate text-[11px] leading-tight text-muted-foreground">
              Default plan
            </p>
          </div>
          <ChevronRightIcon className="size-3.5 text-muted-foreground/60 transition-transform group-hover/user:translate-x-0.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="w-64">
        <DropdownMenuLabel>{user?.name || "Account"}</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserIcon className="size-4" />
            <span>Profile</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <SunIcon className="size-4" />
          <span>Light mode</span>
          {!isDark ? <span className="ml-auto text-xs text-muted-foreground">Active</span> : null}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <MoonIcon className="size-4" />
          <span>Dark mode</span>
          {isDark ? <span className="ml-auto text-xs text-muted-foreground">Active</span> : null}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => logout()}>
          <LogOutIcon className="size-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SearchBar() {
  return (
    <div className="relative">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 z-10 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
      <Input
        placeholder="Search servers, users, pages..."
        className="h-9 border-border/40 bg-muted/20 pl-9 text-sm placeholder:text-muted-foreground/50 focus-visible:bg-muted/40"
      />
    </div>
  )
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive =
    item.url === "/" ? pathname === "/" : pathname.startsWith(item.url)

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={item.title}
        className="h-9 gap-3 px-3 text-[13px] data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
      >
        <Link href={item.url}>
          <item.icon className="size-[18px] shrink-0" />
          <span className="font-medium">{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function AdminSection({ pathname }: { pathname: string }) {
  const { hasPermission } = React.use(AuthenticationContext)

  const visible = navAdmin.filter(
    (item) => !item.permission || hasPermission(item.permission)
  )
  if (visible.length === 0) return null

  return (
    <SidebarGroup className="pt-2 pb-0">
      <SidebarGroupLabel className="mb-1 flex items-center gap-1.5 px-3 text-[11px] font-medium tracking-wider text-muted-foreground/70 uppercase group-data-[collapsible=icon]:hidden">
        Restricted pages
        <LockIcon className="size-3 text-muted-foreground/50" />
      </SidebarGroupLabel>
      {/* Collapsed: thin separator instead of label */}
      <div className="hidden px-1.5 py-2 group-data-[collapsible=icon]:block">
        <Separator />
      </div>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5 group-data-[collapsible=icon]:gap-1">
          {visible.map((item) => (
            <NavLink key={item.url} item={item} pathname={pathname} />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

function FooterBar() {
  const { logout, isAuthenticated } = React.use(AuthenticationContext)
  const [coins, setCoins] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (!isAuthenticated) return
    const token = getAccessToken()
    if (!token) return
    cachedFetch(
      "coins",
      () => api.store.resources(token).then((r) => r.coins),
      60 * 1000
    )
      .then(setCoins)
      .catch(() => {})
  }, [isAuthenticated])

  return (
    <>
      {/* Expanded footer */}
      <div className="group-data-[collapsible=icon]:hidden">
        <Separator className="mb-3" />
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CoinsIcon className="size-3.5" />
            <span className="font-medium">
              {coins !== null ? coins.toFixed(2) : "—"} coins
            </span>
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => logout()}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOutIcon className="size-3.5" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </div>
      {/* Collapsed footer */}
      <div className="hidden flex-col items-center gap-1.5 group-data-[collapsible=icon]:flex">
        <Separator className="mb-1 w-full" />
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex size-8 items-center justify-center rounded-md text-muted-foreground">
              <CoinsIcon className="size-4" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            {coins !== null ? coins.toFixed(2) : "—"} coins
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => logout()}
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOutIcon className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Sign out</TooltipContent>
        </Tooltip>
      </div>
    </>
  )
}
