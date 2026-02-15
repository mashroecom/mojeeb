import { AuthGuard } from '@/components/auth/AuthGuard';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-muted/30">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
          {children}
        </div>
      </div>
    </AuthGuard>
  );
}
