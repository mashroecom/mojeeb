import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'شروط الخدمة' : 'Terms of Service',
    description: isAr
      ? 'شروط استخدام منصة موجيب لدعم العملاء بالذكاء الاصطناعي.'
      : 'Terms of Service for the Mojeeb AI customer support platform.',
  };
}

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
