'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { Loader } from '@/components/Loader';

type ProtectedPageProps = {
  children: React.ReactNode;
  adminOnly?: boolean;
};

export function ProtectedPage({ children, adminOnly }: ProtectedPageProps) {
  const { loading, user, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/signin');
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return <Loader />;
  }

  if (adminOnly && profile?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-50 p-4 text-slate-700">
        <div className="mx-auto max-w-2xl rounded-3xl bg-white p-6 shadow-soft">
          <h1 className="text-xl font-semibold">Accès refusé</h1>
          <p className="mt-3 text-slate-600">Cette page est réservée aux administrateurs.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
