import { Link } from '@/i18n/navigation';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xl">
          M
        </div>
        <span className="text-2xl font-bold">Mojeeb</span>
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
