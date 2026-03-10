import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'سياسة الخصوصية' : 'Privacy Policy',
    description: isAr
      ? 'سياسة الخصوصية لمنصة موجيب. كيف نحمي بياناتك ونستخدمها.'
      : 'Mojeeb Privacy Policy. How we protect and use your data.',
  };
}

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
