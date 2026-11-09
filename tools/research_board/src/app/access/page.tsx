import { redirect } from 'next/navigation';
export default async function Access({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = (await searchParams).next ?? '';
  redirect(/^\/workspace(?:\?|\/|$)/.test(next) ? next : '/workspace');
}
