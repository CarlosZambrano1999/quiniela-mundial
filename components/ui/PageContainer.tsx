type PageContainerProps = {
  children: React.ReactNode;
};

export default function PageContainer({ children }: PageContainerProps) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-blue-50 px-6 py-8">
      <section className="mx-auto max-w-6xl">{children}</section>
    </main>
  );
}