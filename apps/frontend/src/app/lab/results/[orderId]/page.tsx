import { redirect } from 'next/navigation';

export default function LabResultRedirectPage({ params }: { params: { orderId: string } }) {
  redirect(`/diagnostics/${params.orderId}`);
}
