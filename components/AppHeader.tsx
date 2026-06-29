"use client";

import Link from "next/link";
import { useAuth } from "@/lib/context/AuthContext";
import BotonCerrarSesion from "@/components/BotonCerrarSesion";

export default function AppHeader() {
  const { usuario, perfil } = useAuth();

  return (
    <header className="mb-8 rounded-2xl border border-slate-200 bg-white/90 px-5 py-4 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Link href="/" className="text-lg font-black text-slate-900">
            Quiniela Mundial
          </Link>

          <p className="text-sm text-slate-500">
            Predicciones, resultados y ranking en tiempo real
          </p>
        </div>

        <nav className="flex flex-wrap items-center gap-3">
          {/* 
          <Link
            href="/quiniela"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Grupos
          </Link>
*/}
          <Link
            href="/eliminatoria"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Eliminatoria
          </Link>

          <Link
            href="/ranking-eliminatoria"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Ranking Eliminatoria
          </Link>

          <Link
            href="/en-vivo"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Demás predicciones
          </Link>

          <Link
            href="/ranking"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Ranking
          </Link>

          {perfil?.rol === "admin" && (
            <Link
              href="/admin/partidos"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
            >
              Admin
            </Link>
          )}

          {usuario ? (
            <BotonCerrarSesion />
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Iniciar sesión
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}