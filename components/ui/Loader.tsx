type LoaderProps = {
  texto?: string;
};

export default function Loader({ texto = "Cargando..." }: LoaderProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
        <p className="text-sm font-medium text-slate-600">{texto}</p>
      </div>
    </main>
  );
}