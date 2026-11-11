import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from 'next/font/google';

// One family for both scripts: IBM Plex Sans for Latin, its Arabic companion for Arabic.
export const fontEnglish = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-english',
  display: 'swap',
});

export const fontArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-arabic',
  display: 'swap',
});
