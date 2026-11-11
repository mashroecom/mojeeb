import { Link } from '@/i18n/navigation';
import { AuthRedirect } from '@/components/auth/AuthRedirect';
import { NO_INDEX } from '@/lib/seo';
import { LogoMark, brandName } from '@/components/brand/Logo';
import { getLocale } from 'next-intl/server';

export const metadata = NO_INDEX;

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <LogoMark className="h-10 w-10" />
        <span className="text-2xl font-bold tracking-tight">{brandName(null, locale)}</span>
      </Link>
      <div className="w-full max-w-md">
        <AuthRedirect>{children}</AuthRedirect>
      </div>
    </div>
  );
}
