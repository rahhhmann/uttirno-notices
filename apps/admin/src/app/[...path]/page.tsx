import { AdminRoute } from '../../features/route';
export default async function Page({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return <AdminRoute path={path} />;
}
