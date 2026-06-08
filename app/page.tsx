export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center px-6">
      <section className="max-w-2xl w-full rounded-2xl bg-white p-8 shadow">
        <p className="text-sm font-semibold text-blue-600">
          Quiniela Mundial
        </p>

        <h1 className="mt-3 text-3xl font-bold text-slate-900">
          Bienvenido a la quiniela
        </h1>

        <p className="mt-4 text-slate-600">
          Registra tus predicciones, consulta los partidos y compite en el
          ranking general.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            href="/login"
            className="rounded-lg bg-blue-600 px-5 py-3 text-center font-medium text-white hover:bg-blue-700"
          >
            Iniciar sesión
          </a>

          <a
            href="/ranking"
            className="rounded-lg border border-slate-300 px-5 py-3 text-center font-medium text-slate-700 hover:bg-slate-50"
          >
            Ver ranking
          </a>
        </div>
      </section>
    </main>
  );
}