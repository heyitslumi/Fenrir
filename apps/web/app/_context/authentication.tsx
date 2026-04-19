'use client';

import {
  createContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api, type AuthUser, type BrandConfig } from '@/lib/api';
import { cachedFetch } from '@/lib/cache';
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
} from '@/lib/auth';

function LoadingScreen() {
  const [brand, setBrand] = useState<BrandConfig>({});

  useEffect(() => {
    cachedFetch('brand', () => api.settings.getBrand(), 5 * 60 * 1000)
      .then(setBrand)
      .catch(() => {});
  }, []);

  const logo = brand['panel.logo'];
  const name = brand['panel.name'] || 'Panel';

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
        {logo ? (
          <img src={logo} alt={name} width={48} height={48} className="rounded-lg" />
        ) : (
          <div className="flex size-12 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xl font-bold">
            {name.charAt(0)}
          </div>
        )}
        <div className="text-center">
          <h2 className="text-lg font-semibold">Welcome back</h2>
          <p className="text-sm text-muted-foreground mt-1">Loading your dashboard...</p>
        </div>
        <div className="flex gap-1 mt-2">
          <span className="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
          <span className="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
          <span className="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

export interface AuthContextData {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
}

const AuthenticationContext = createContext<AuthContextData>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  hasPermission: () => false,
  hasRole: () => false,
});

export default AuthenticationContext;

export function AuthenticationProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  const loadUser = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const { user: userData } = await api.auth.me(token);
      setUser(userData);
    } catch {
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        try {
          const res = await api.auth.refresh(refreshToken);
          setTokens(res.accessToken, res.refreshToken);
          setUser(res.user);
        } catch {
          clearTokens();
          setUser(null);
        }
      } else {
        clearTokens();
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (!isLoading) {
      const isAuthPage = pathname.startsWith('/authentication');
      const isOAuthCallback = pathname.startsWith('/authentication/oauth');
      if (!user && !isAuthPage) {
        router.replace('/authentication/login');
      } else if (user && isAuthPage && !isOAuthCallback) {
        router.replace('/');
      }
    }
  }, [user, isLoading, pathname, router]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.auth.login({ email, password });
    setTokens(res.accessToken, res.refreshToken);
    setUser(res.user);
  }, []);

  const register = useCallback(
    async (email: string, password: string, name?: string) => {
      const res = await api.auth.register({ email, password, name });
      setTokens(res.accessToken, res.refreshToken);
      setUser(res.user);
    },
    [],
  );

  const logout = useCallback(async () => {
    const token = getAccessToken();
    if (token) {
      try {
        await api.auth.logout(token);
      } catch {
        // ignore
      }
    }
    clearTokens();
    setUser(null);
    router.replace('/authentication/login');
  }, [router]);

  const hasPermission = useCallback(
    (permission: string) => user?.permissions?.includes(permission) ?? false,
    [user],
  );

  const hasRole = useCallback(
    (role: string) => user?.role === role,
    [user],
  );

  return (
    <AuthenticationContext
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        hasPermission,
        hasRole,
      }}
    >
      {isLoading && !pathname.startsWith('/authentication') ? (
        <LoadingScreen />
      ) : (
        children
      )}
    </AuthenticationContext>
  );
}
