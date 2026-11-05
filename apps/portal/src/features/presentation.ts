import type { ExtractedFact, FieldName } from '@uttirno/contracts';
export type Locale = 'bn' | 'en';
export const locale = (value: unknown): Locale => (value === 'en' ? 'en' : 'bn');
export const text = (lang: Locale, bn: string, en: string) => (lang === 'bn' ? bn : en);
export function unknown(status: string, lang: Locale) {
  const labels: Record<string, [string, string]> = {
    not_stated: ['বিজ্ঞপ্তিতে উল্লেখ নেই', 'Not stated in notice'],
    not_extracted: ['তথ্য উদ্ধার করা যায়নি', 'Not extracted'],
    conflicting: ['পরস্পরবিরোধী তথ্য', 'Conflicting information'],
    not_applicable: ['প্রযোজ্য নয়', 'Not applicable'],
    unknown: ['অবস্থা অজানা', 'Status unknown'],
    upcoming: ['আবেদন শুরু হয়নি', 'Upcoming'],
    open: ['আবেদন চলছে', 'Open'],
    closed: ['আবেদন বন্ধ', 'Closed'],
    cancelled: ['বাতিল', 'Cancelled'],
  };
  const pair = labels[status];
  return pair ? pair[lang === 'bn' ? 0 : 1] : status;
}
export function factText(fact: ExtractedFact, lang: Locale) {
  return fact.status === 'stated' ? fact.candidate.raw : unknown(fact.status, lang);
}
export const labels: Record<FieldName, [string, string]> = {
  title: ['পদের নাম', 'Title'],
  postCode: ['পদ কোড', 'Post code'],
  vacancies: ['শূন্যপদ', 'Vacancies'],
  qualifications: ['যোগ্যতা', 'Qualifications'],
  age: ['বয়স ও reference date', 'Age and reference date'],
  salary: ['বেতন', 'Salary'],
  experience: ['অভিজ্ঞতা', 'Experience'],
  district: ['জেলা', 'District'],
  quota: ['কোটা', 'Quota'],
  applicationDeadline: ['আবেদনের শেষ সময়', 'Submission deadline'],
  paymentDeadline: ['ফি দেওয়ার শেষ সময়', 'Payment deadline'],
  fee: ['আবেদন ফি', 'Application fee'],
  serviceCharge: ['সার্ভিস চার্জ', 'Service charge'],
  applicationSteps: ['আবেদনের ধাপ', 'Application steps'],
  documents: ['প্রয়োজনীয় কাগজপত্র', 'Required documents'],
  contact: ['যোগাযোগ', 'Contact'],
  applicationUrl: ['অফিশিয়াল আবেদন ঠিকানা', 'Official application destination'],
};
export function dateText(value: string | null, lang: Locale) {
  return value
    ? new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', {
        timeZone: 'Asia/Dhaka',
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value)) + ' (Asia/Dhaka)'
    : text(lang, 'অজানা', 'Unknown');
}
