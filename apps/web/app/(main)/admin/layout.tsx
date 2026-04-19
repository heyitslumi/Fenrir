'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import AuthenticationContext from '@/app/_context/authentication';
import { ShieldAlertIcon } from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, hasRole } = use(AuthenticationContext);
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (!user || !hasRole('admin')) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <ShieldAlertIcon className="size-12 text-destructive" />
        <h1 className="text-2xl font-semibold">Access Denied</h1>
        <p className="text-muted-foreground text-center max-w-md">
          You do not have permission to access this area. Admin role is required.
        </p>
        <button
          onClick={() => router.push('/')}
          className="mt-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
