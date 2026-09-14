/** Rendered when a hostname matches no active tenant (see src/proxy.ts). */
export default function TenantNotFoundPage() {
  return (
    <main className='flex min-h-screen flex-col items-center justify-center px-6 text-center'>
      <h1 className='text-2xl font-semibold'>Store not found</h1>
      <p className='mt-2 text-gray-600'>
        No store is configured at this address.
      </p>
    </main>
  );
}
