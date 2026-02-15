import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'اطلب عرض توضيحي مجاني' : 'Request a Free Demo',
    description: isAr
      ? 'احجز مكالمة عرض مجانية مع فريق موجيب. شاهد كيف يمكن للذكاء الاصطناعي تحسين دعم عملائك.'
      : 'Book a free demo call with the Mojeeb team. See how AI can transform your customer support.',
  };
}

export default function RequestDemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
