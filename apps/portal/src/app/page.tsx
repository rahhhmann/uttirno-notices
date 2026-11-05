import Link from 'next/link';
export default function Page() {
  return (
    <>
      <h1>উত্তীর্ণ চাকরির পোর্টাল</h1>
      <p>অফিশিয়াল নিয়োগের তথ্য, মূল বিজ্ঞপ্তি ও আবেদনের ঠিকানা।</p>
      <p>Official recruitment information, original notices and application destinations.</p>
      <Link className="button" href="/jobs">
        চাকরি খুঁজুন / Browse jobs
      </Link>
    </>
  );
}
