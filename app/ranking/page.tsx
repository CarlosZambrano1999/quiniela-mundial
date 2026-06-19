"use client";

import { useEffect, useMemo, useState } from "react";
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
  puntosTotales?: number;
};

type PrediccionRanking = {
  id: string;
  userId: string;
  puntos?: number;
  partidoFinalizado?: boolean;
};

type EstadisticaUsuario = {
  exactos: number;
  acertados: number;
  perdidos: number;
  puntosExactos: number;
  puntosAcertados: number;
  puntosTotalesCalculados: number;
};

type UsuarioRankingExtendido = UsuarioRanking & EstadisticaUsuario;

export default function RankingPage() {
  const [usuarios, setUsuarios] = useState<UsuarioRanking[]>([]);
  const [predicciones, setPredicciones] = useState<PrediccionRanking[]>([]);
  const [cargandoUsuarios, setCargandoUsuarios] = useState(true);
  const [cargandoPredicciones, setCargandoPredicciones] = useState(true);
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
        setCargandoUsuarios(false);
      },
      (error) => {
        console.error(error);
        setMensajeError("No se pudo cargar el ranking.");
        setCargandoUsuarios(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const prediccionesQuery = query(collection(db, "predictions"));

    const unsubscribe = onSnapshot(
      prediccionesQuery,
      (snapshot) => {
        const lista = snapshot.docs.map((documento) => ({
          id: documento.id,
          ...documento.data(),
        })) as PrediccionRanking[];

        setPredicciones(lista);
        setCargandoPredicciones(false);
      },
      (error) => {
        console.error(error);
        setMensajeError("No se pudieron cargar las estadísticas del ranking.");
        setCargandoPredicciones(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const usuariosRanking = useMemo(() => {
    const estadisticasPorUsuario = new Map<string, EstadisticaUsuario>();

    predicciones.forEach((prediccion) => {
      if (!prediccion.partidoFinalizado) {
        return;
      }

      const puntos = prediccion.puntos ?? 0;

      const estadisticaActual = estadisticasPorUsuario.get(prediccion.userId) ?? {
        exactos: 0,
        acertados: 0,
        perdidos: 0,
        puntosExactos: 0,
        puntosAcertados: 0,
        puntosTotalesCalculados: 0,
      };

      if (puntos === 3) {
        estadisticaActual.exactos += 1;
        estadisticaActual.puntosExactos += 3;
      } else if (puntos === 1) {
        estadisticaActual.acertados += 1;
        estadisticaActual.puntosAcertados += 1;
      } else {
        estadisticaActual.perdidos += 1;
      }

      estadisticaActual.puntosTotalesCalculados += puntos;

      estadisticasPorUsuario.set(prediccion.userId, estadisticaActual);
    });

    return usuarios
      .map((usuario) => {
        const estadistica = estadisticasPorUsuario.get(usuario.uid) ?? {
          exactos: 0,
          acertados: 0,
          perdidos: 0,
          puntosExactos: 0,
          puntosAcertados: 0,
          puntosTotalesCalculados: usuario.puntosTotales ?? 0,
        };

        return {
          ...usuario,
          ...estadistica,
        };
      })
      .sort((a, b) => {
        if (b.puntosTotalesCalculados !== a.puntosTotalesCalculados) {
          return b.puntosTotalesCalculados - a.puntosTotalesCalculados;
        }

        if (b.exactos !== a.exactos) {
          return b.exactos - a.exactos;
        }

        if (b.acertados !== a.acertados) {
          return b.acertados - a.acertados;
        }

        return (a.nombre || a.email || "").localeCompare(
          b.nombre || b.email || ""
        );
      });
  }, [usuarios, predicciones]);

  function obtenerMedalla(posicion: number) {
    if (posicion === 1) return "🥇";
    if (posicion === 2) return "🥈";
    if (posicion === 3) return "🥉";
    return posicion;
  }

  const cargando = cargandoUsuarios || cargandoPredicciones;

  if (cargando) {
    return <Loader texto="Cargando ranking..." />;
  }

  const lider = usuariosRanking[0];

  return (
    <PageContainer>
      <AppHeader />

      <div className="mb-8">
        <p className="text-sm font-semibold text-blue-600">
          Tabla de posiciones
        </p>

        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
          Ranking general
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
          Consulta los puntos acumulados, marcadores exactos y aciertos por
          resultado de todos los participantes.
        </p>
      </div>

      {mensajeError && (
        <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {mensajeError}
        </div>
      )}

      {lider && (
        <Card className="mb-6 bg-gradient-to-r from-blue-600 to-slate-900 text-white">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-100">
                Líder actual
              </p>

              <h2 className="mt-2 text-3xl font-black">
                🥇 {lider.nombre || "Sin nombre"}
              </h2>

              <p className="mt-1 text-sm text-blue-100">{lider.email}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white">
                  Exactos: {lider.exactos}
                </span>

                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white">
                  Acertados: {lider.acertados}
                </span>

                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white">
                  Perdidos: {lider.perdidos}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-white/15 px-4 py-4">
                <p className="text-xs font-medium text-blue-100">
                  Total
                </p>
                <p className="text-3xl font-black">
                  {lider.puntosTotalesCalculados}
                </p>
              </div>

              <div className="rounded-2xl bg-white/15 px-4 py-4">
                <p className="text-xs font-medium text-blue-100">
                  Exactos
                </p>
                <p className="text-3xl font-black">
                  {lider.puntosExactos}
                </p>
              </div>

              <div className="rounded-2xl bg-white/15 px-4 py-4">
                <p className="text-xs font-medium text-blue-100">
                  Aciertos
                </p>
                <p className="text-3xl font-black">
                  {lider.puntosAcertados}
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}


      <Card>
        {usuariosRanking.length === 0 ? (
          <p className="text-slate-600">Todavía no hay usuarios registrados.</p>
        ) : (
          <>
            <div className="space-y-4 md:hidden">
              {usuariosRanking.map((usuario, index) => {
                const posicion = index + 1;

                return (
                  <div
                    key={usuario.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-black text-slate-700">
                            {obtenerMedalla(posicion)}
                          </span>

                          <div className="min-w-0">
                            <p className="truncate font-black text-slate-900">
                              {usuario.nombre || "Sin nombre"}
                            </p>

                            <p className="truncate text-xs text-slate-500">
                              {usuario.email}
                            </p>
                          </div>
                        </div>

                        {usuario.rol === "admin" && (
                          <div className="mt-2">
                            <Badge variant="blue">Administrador</Badge>
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-500">
                          Puntos
                        </p>
                        <p className="text-3xl font-black text-slate-900">
                          {usuario.puntosTotalesCalculados}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="rounded-xl bg-green-50 p-3 text-center">
                        <p className="text-xs font-bold text-green-700">
                          Exactos
                        </p>
                        <p className="text-xl font-black text-green-700">
                          {usuario.exactos}
                        </p>
                        <p className="text-xs font-semibold text-green-600">
                          {usuario.puntosExactos} pts
                        </p>
                      </div>

                      <div className="rounded-xl bg-blue-50 p-3 text-center">
                        <p className="text-xs font-bold text-blue-700">
                          Acertados
                        </p>
                        <p className="text-xl font-black text-blue-700">
                          {usuario.acertados}
                        </p>
                        <p className="text-xs font-semibold text-blue-600">
                          {usuario.puntosAcertados} pts
                        </p>
                      </div>

                      <div className="rounded-xl bg-red-50 p-3 text-center">
                        <p className="text-xs font-bold text-red-700">
                          Perdidos
                        </p>
                        <p className="text-xl font-black text-red-700">
                          {usuario.perdidos}
                        </p>
                        <p className="text-xs font-semibold text-red-600">
                          0 pts
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-3 pr-4 font-semibold">Posición</th>
                    <th className="py-3 pr-4 font-semibold">Participante</th>
                    <th className="py-3 pr-4 font-semibold">Correo</th>
                    <th className="py-3 pr-4 text-center font-semibold">
                      Exactos
                    </th>
                    <th className="py-3 pr-4 text-center font-semibold">
                      Pts exactos
                    </th>
                    <th className="py-3 pr-4 text-center font-semibold">
                      Acertados
                    </th>
                    <th className="py-3 pr-4 text-center font-semibold">
                      Pts acertados
                    </th>
                    <th className="py-3 pr-4 text-center font-semibold">
                      Perdidos
                    </th>
                    <th className="py-3 pr-4 text-right font-semibold">
                      Total
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {usuariosRanking.map((usuario, index) => {
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

                        <td className="py-4 pr-4 text-center">
                          <span className="font-black text-green-700">
                            {usuario.exactos}
                          </span>
                        </td>

                        <td className="py-4 pr-4 text-center">
                          <span className="font-black text-green-700">
                            {usuario.puntosExactos}
                          </span>
                        </td>

                        <td className="py-4 pr-4 text-center">
                          <span className="font-black text-blue-700">
                            {usuario.acertados}
                          </span>
                        </td>

                        <td className="py-4 pr-4 text-center">
                          <span className="font-black text-blue-700">
                            {usuario.puntosAcertados}
                          </span>
                        </td>

                        <td className="py-4 pr-4 text-center">
                          <span className="font-black text-red-700">
                            {usuario.perdidos}
                          </span>
                        </td>

                        <td className="py-4 pr-4 text-right">
                          <span className="text-2xl font-black text-slate-900">
                            {usuario.puntosTotalesCalculados}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </PageContainer>
  );
}