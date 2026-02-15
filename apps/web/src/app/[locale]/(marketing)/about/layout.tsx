import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'عن موجيب' : 'About Mojeeb',
    description: isAr
      ? 'تعرف على موجيب - منصة دعم العملاء بالذكاء الاصطناعي. مهمتنا ورؤيتنا وفريقنا.'
      : 'Learn about Mojeeb - the AI customer support platform. Our mission, vision, and team.',
  };
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
