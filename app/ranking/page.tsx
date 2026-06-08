"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AppHeader from "@/components/AppHeader";
import PageContainer from "@/components/ui/PageContainer";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Loader from "@/components/ui/Loader";

type UsuarioRanking = {
  id: string;
  uid: string;
  nombre: string;
  email: string;
  rol: "participante" | "admin";
  puntosTotales: number;
};

export default function RankingPage() {
  const [usuarios, setUsuarios] = useState<UsuarioRanking[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensajeError, setMensajeError] = useState("");

  useEffect(() => {
    const rankingQuery = query(
      collection(db, "users"),
      orderBy("puntosTotales", "desc")
    );

    const unsubscribe = onSnapshot(
      rankingQuery,
      (snapshot) => {
        const lista = snapshot.docs.map((documento) => ({
          id: documento.id,
          ...documento.data(),
        })) as UsuarioRanking[];

        setUsuarios(lista);
        setCargando(false);
      },
      (error) => {
        console.error(error);
        setMensajeError("No se pudo cargar el ranking.");
        setCargando(false);
      }
    );

    return () => unsubscribe();
  }, []);

  function obtenerMedalla(posicion: number) {
    if (posicion === 1) return "🥇";
    if (posicion === 2) return "🥈";
    if (posicion === 3) return "🥉";
    return posicion;
  }

  if (cargando) {
  return <Loader texto="Cargando sesión..." />;
}

  const lider = usuarios[0];

  return (
    <PageContainer>
      <AppHeader />

      <div className="mb-8">
        <p className="text-sm font-semibold text-blue-600">
          Tabla de posiciones
        </p>

        <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">
          Ranking general
        </h1>

        <p className="mt-2 max-w-2xl text-slate-600">
          Consulta los puntos acumulados de todos los participantes de la
          quiniela.
        </p>
      </div>

      {mensajeError && (
        <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {mensajeError}
        </div>
      )}

      {lider && (
        <Card className="mb-6 bg-gradient-to-r from-blue-600 to-slate-900 text-white">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-100">
                Líder actual
              </p>

              <h2 className="mt-2 text-3xl font-black">
                🥇 {lider.nombre || "Sin nombre"}
              </h2>

              <p className="mt-1 text-blue-100">{lider.email}</p>
            </div>

            <div className="rounded-2xl bg-white/15 px-6 py-4 text-center">
              <p className="text-sm font-medium text-blue-100">Puntos</p>
              <p className="text-4xl font-black">{lider.puntosTotales ?? 0}</p>
            </div>
          </div>
        </Card>
      )}

      <Card>
        {usuarios.length === 0 ? (
          <p className="text-slate-600">Todavía no hay usuarios registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-3 pr-4 font-semibold">Posición</th>
                  <th className="py-3 pr-4 font-semibold">Participante</th>
                  <th className="py-3 pr-4 font-semibold">Correo</th>
                  <th className="py-3 pr-4 text-right font-semibold">
                    Puntos
                  </th>
                </tr>
              </thead>

              <tbody>
                {usuarios.map((usuario, index) => {
                  const posicion = index + 1;

                  return (
                    <tr
                      key={usuario.id}
                      className="border-b border-slate-100 text-slate-700 last:border-b-0 hover:bg-slate-50"
                    >
                      <td className="py-4 pr-4">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-black text-slate-700">
                          {obtenerMedalla(posicion)}
                        </span>
                      </td>

                      <td className="py-4 pr-4">
                        <div>
                          <p className="font-bold text-slate-900">
                            {usuario.nombre || "Sin nombre"}
                          </p>

                          {usuario.rol === "admin" && (
                            <div className="mt-1">
                              <Badge variant="blue">Administrador</Badge>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="py-4 pr-4 text-slate-500">
                        {usuario.email}
                      </td>

                      <td className="py-4 pr-4 text-right">
                        <span className="text-2xl font-black text-slate-900">
                          {usuario.puntosTotales ?? 0}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PageContainer>
  );
}