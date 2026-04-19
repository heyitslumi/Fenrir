'use client';

import * as React from 'react';

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
} from '@workspace/ui/components/sidebar';
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
  type LucideIcon,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import AuthenticationContext from '@/app/_context/authentication';
import { api, type BrandConfig } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { cachedFetch } from '@/lib/cache';
import { Separator } from '@workspace/ui/components/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@workspace/ui/components/tooltip';

type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  permission?: string;
};

function getInitials(source: string | undefined | null): string {
  if (!source || !source.trim()) return 'U';
  return source.trim().charAt(0).toUpperCase();
}

const navMain: NavItem[] = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboardIcon },
  { title: 'Servers', url: '/servers', icon: ServerIcon },
  { title: 'Profile', url: '/profile', icon: UserIcon },
  { title: 'Store', url: '/store', icon: StoreIcon },
  { title: 'AFK', url: '/afk', icon: ClockIcon },
];

const navAdmin: NavItem[] = [
  { title: 'Admin', url: '/admin', icon: ShieldIcon, permission: 'users.read' },
  { title: 'Users', url: '/admin/users', icon: UsersIcon, permission: 'users.read' },
  { title: 'Servers', url: '/admin/servers', icon: ServerIcon, permission: 'servers.read' },
  { title: 'Roles', url: '/admin/roles', icon: KeyIcon, permission: 'roles.read' },
  { title: 'Eggs', url: '/admin/eggs', icon: EggIcon, permission: 'eggs.read' },
  { title: 'Locations', url: '/admin/locations', icon: MapPinIcon, permission: 'settings.read' },
  { title: 'Packages', url: '/admin/packages', icon: PackageIcon, permission: 'packages.read' },
  { title: 'Sync', url: '/admin/sync', icon: RefreshCwIcon, permission: 'settings.write' },
  { title: 'Settings', url: '/admin/settings', icon: SettingsIcon, permission: 'settings.read' },
];

export default function Sidebar({
  ...props
}: React.ComponentProps<typeof RawSidebar>) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const [brand, setBrand] = React.useState<BrandConfig>({});

  React.useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [pathname, isMobile, setOpenMobile]);

  React.useEffect(() => {
    cachedFetch('brand', () => api.settings.getBrand(), 5 * 60 * 1000)
      .then(setBrand)
      .catch(() => {});
  }, []);

  return (
    <RawSidebar collapsible="icon" {...props}>
      <SidebarHeader className="px-4 pt-5 pb-0 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:pt-4 group-data-[collapsible=icon]:pb-0 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center">
        <BrandHeader brand={brand} />
      </SidebarHeader>

      {/* Expanded: user card + search */}
      <div className="px-4 py-3 group-data-[collapsible=icon]:hidden flex flex-col gap-3">
        <UserCard />
        <SearchBar />
      </div>

      {/* Collapsed: avatar only */}
      <div className="hidden group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center py-3">
        <CollapsedAvatar />
      </div>

      <SidebarContent className="px-3 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:items-center">
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

      <SidebarFooter className="px-4 pb-4 pt-0 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:pb-4">
        <FooterBar />
      </SidebarFooter>
    </RawSidebar>
  );
}

function BrandHeader({ brand }: { brand: BrandConfig }) {
  const logo = brand['panel.logo'];
  const name = brand['panel.name'];
  const logoHeight = parseInt(brand['panel.logoHeight'] || '32', 10);
  const showName = name || !logo;

  return (
    <>
      {/* Expanded */}
      <div className="group-data-[collapsible=icon]:hidden">
        <div className="flex items-center gap-2.5">
          {logo && (
            <Image
              src={logo}
              alt={name || 'Logo'}
              width={32}
              height={32}
              className="object-contain shrink-0 size-8"
              unoptimized
            />
          )}
          {showName && (
            <h1 className="text-base font-bold tracking-tight truncate">{name || 'Panel'}</h1>
          )}
        </div>
      </div>
      {/* Collapsed */}
      <div className="hidden group-data-[collapsible=icon]:block">
        {logo ? (
          <Image
            src={logo}
            alt={name || 'Logo'}
            width={24}
            height={24}
            className="object-contain size-6"
            unoptimized
          />
        ) : (
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
            {(name || 'P').charAt(0)}
          </div>
        )}
      </div>
    </>
  );
}

function getAvatarUrl(avatar: string | null | undefined) {
  if (!avatar) return null;
  if (avatar.startsWith('http')) return avatar;
  const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '');
  return `${base}${avatar}`;
}

function CollapsedAvatar() {
  const { user, isLoading } = React.use(AuthenticationContext);
  const src = getAvatarUrl(user?.avatar);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href="/profile"
          className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xs font-semibold shadow-sm transition-opacity hover:opacity-80 overflow-hidden"
        >
          {src ? (
            <img src={src} alt="Avatar" className="size-full object-cover" />
          ) : (
            isLoading ? '·' : getInitials(user?.name || user?.email)
          )}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">{user?.name || 'Profile'}</TooltipContent>
    </Tooltip>
  );
}

function UserCard() {
  const { user, isLoading } = React.use(AuthenticationContext);

  return (
    <Link
      href="/profile"
      className="group/user flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/60"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white text-sm font-semibold shadow-sm overflow-hidden">
        {getAvatarUrl(user?.avatar) ? (
          <img src={getAvatarUrl(user?.avatar)!} alt="Avatar" className="size-full object-cover" />
        ) : (
          isLoading ? '·' : getInitials(user?.name || user?.email)
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight truncate">
          {user?.name || 'User'}
        </p>
        <p className="text-[11px] text-muted-foreground leading-tight truncate">
          Default plan
        </p>
      </div>
      <ChevronRightIcon className="size-3.5 text-muted-foreground/60 transition-transform group-hover/user:translate-x-0.5" />
    </Link>
  );
}

function SearchBar() {
  return (
    <div className="relative">
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/60" />
      <input
        placeholder="Search..."
        className="flex h-9 w-full rounded-lg border border-border/40 bg-muted/20 px-3 pl-9 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-border focus:bg-muted/40"
      />
    </div>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive = item.url === '/' ? pathname === '/' : pathname.startsWith(item.url);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={item.title} className="h-9 gap-3 px-3 text-[13px] data-[active=true]:bg-primary/10 data-[active=true]:text-primary">
        <Link href={item.url}>
          <item.icon className="size-[18px] shrink-0" />
          <span className="font-medium">{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function AdminSection({ pathname }: { pathname: string }) {
  const { hasPermission } = React.use(AuthenticationContext);

  const visible = navAdmin.filter(
    (item) => !item.permission || hasPermission(item.permission),
  );
  if (visible.length === 0) return null;

  return (
    <SidebarGroup className="pt-2 pb-0">
      <SidebarGroupLabel className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1.5 group-data-[collapsible=icon]:hidden">
        Restricted pages
        <LockIcon className="size-3 text-muted-foreground/50" />
      </SidebarGroupLabel>
      {/* Collapsed: thin separator instead of label */}
      <div className="hidden group-data-[collapsible=icon]:block px-1.5 py-2">
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
  );
}

function FooterBar() {
  const { logout, isAuthenticated } = React.use(AuthenticationContext);
  const [coins, setCoins] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!isAuthenticated) return;
    const token = getAccessToken();
    if (!token) return;
    cachedFetch('coins', () => api.store.resources(token).then((r) => r.coins), 60 * 1000)
      .then(setCoins)
      .catch(() => {});
  }, [isAuthenticated]);

  return (
    <>
      {/* Expanded footer */}
      <div className="group-data-[collapsible=icon]:hidden">
        <Separator className="mb-3" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CoinsIcon className="size-3.5" />
            <span className="font-medium">{coins !== null ? coins.toFixed(2) : '—'} coins</span>
          </div>
          <button
            onClick={() => logout()}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOutIcon className="size-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </div>
      {/* Collapsed footer */}
      <div className="hidden group-data-[collapsible=icon]:flex flex-col items-center gap-1.5">
        <Separator className="mb-1 w-full" />
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex size-8 items-center justify-center rounded-md text-muted-foreground">
              <CoinsIcon className="size-4" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">{coins !== null ? coins.toFixed(2) : '—'} coins</TooltipContent>
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
  );
}
