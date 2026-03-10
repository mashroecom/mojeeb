import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'الوظائف' : 'Careers',
    description: isAr
      ? 'انضم لفريق موجيب. نبحث عن مطورين ومصممين ومتخصصين في الذكاء الاصطناعي.'
      : 'Join the Mojeeb team. We are looking for developers, designers, and AI specialists.',
  };
}

export default function CareersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
