"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
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
};

type PrediccionEliminatoriaRanking = {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  tipoPartido?: string;
  partidoFinalizado?: boolean;

  puntos?: number;
  puntosEliminatoria?: number;
  puntosExacto?: number;
  puntosGanador?: number;
  puntosDiferencia?: number;
  puntosPenales?: number;
};

type EstadisticaEliminatoria = {
  partidosCalculados: number;

  exactos: number;
  ganadores: number;
  diferencias: number;
  penales: number;

  puntosExacto: number;
  puntosGanador: number;
  puntosDiferencia: number;
  puntosPenales: number;
  puntosEliminatoria: number;
};

type UsuarioRankingEliminatoria = UsuarioRanking & EstadisticaEliminatoria;

export default function RankingEliminatoriaPage() {
  const [usuarios, setUsuarios] = useState<UsuarioRanking[]>([]);
  const [predicciones, setPredicciones] = useState<
    PrediccionEliminatoriaRanking[]
  >([]);
  const [cargandoUsuarios, setCargandoUsuarios] = useState(true);
  const [cargandoPredicciones, setCargandoPredicciones] = useState(true);
  const [mensajeError, setMensajeError] = useState("");

  useEffect(() => {
    const usuariosQuery = query(collection(db, "users"));

    const unsubscribe = onSnapshot(
      usuariosQuery,
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
        setMensajeError("No se pudieron cargar los usuarios.");
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
        })) as PrediccionEliminatoriaRanking[];

        setPredicciones(lista);
        setCargandoPredicciones(false);
      },
      (error) => {
        console.error(error);
        setMensajeError("No se pudieron cargar las predicciones.");
        setCargandoPredicciones(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const rankingEliminatoria = useMemo(() => {
    const estadisticasPorUsuario = new Map<string, EstadisticaEliminatoria>();

    predicciones.forEach((prediccion) => {
      if (prediccion.tipoPartido !== "eliminatoria") {
        return;
      }

      if (!prediccion.partidoFinalizado) {
        return;
      }

      const actual = estadisticasPorUsuario.get(prediccion.userId) ?? {
        partidosCalculados: 0,

        exactos: 0,
        ganadores: 0,
        diferencias: 0,
        penales: 0,

        puntosExacto: 0,
        puntosGanador: 0,
        puntosDiferencia: 0,
        puntosPenales: 0,
        puntosEliminatoria: 0,
      };

      const puntosExacto = prediccion.puntosExacto ?? 0;
      const puntosGanador = prediccion.puntosGanador ?? 0;
      const puntosDiferencia = prediccion.puntosDiferencia ?? 0;
      const puntosPenales = prediccion.puntosPenales ?? 0;
      const puntosEliminatoria =
        prediccion.puntosEliminatoria ?? prediccion.puntos ?? 0;

      actual.partidosCalculados += 1;

      if (puntosExacto > 0) actual.exactos += 1;
      if (puntosGanador > 0) actual.ganadores += 1;
      if (puntosDiferencia > 0) actual.diferencias += 1;
      if (puntosPenales > 0) actual.penales += 1;

      actual.puntosExacto += puntosExacto;
      actual.puntosGanador += puntosGanador;
      actual.puntosDiferencia += puntosDiferencia;
      actual.puntosPenales += puntosPenales;
      actual.puntosEliminatoria += puntosEliminatoria;

      estadisticasPorUsuario.set(prediccion.userId, actual);
    });

    return usuarios
      .map((usuario) => {
        const estadistica = estadisticasPorUsuario.get(usuario.uid) ?? {
          partidosCalculados: 0,

          exactos: 0,
          ganadores: 0,
          diferencias: 0,
          penales: 0,

          puntosExacto: 0,
          puntosGanador: 0,
          puntosDiferencia: 0,
          puntosPenales: 0,
          puntosEliminatoria: 0,
        };

        return {
          ...usuario,
          ...estadistica,
        };
      })
      .sort((a, b) => {
        if (b.puntosEliminatoria !== a.puntosEliminatoria) {
          return b.puntosEliminatoria - a.puntosEliminatoria;
        }

        if (b.exactos !== a.exactos) {
          return b.exactos - a.exactos;
        }

        if (b.ganadores !== a.ganadores) {
          return b.ganadores - a.ganadores;
        }

        if (b.diferencias !== a.diferencias) {
          return b.diferencias - a.diferencias;
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

  const resumen = useMemo(() => {
    return rankingEliminatoria.reduce(
      (total, usuario) => {
        total.puntos += usuario.puntosEliminatoria;
        total.exactos += usuario.exactos;
        total.ganadores += usuario.ganadores;
        total.diferencias += usuario.diferencias;
        total.penales += usuario.penales;
        total.partidosCalculados += usuario.partidosCalculados;

        return total;
      },
      {
        puntos: 0,
        exactos: 0,
        ganadores: 0,
        diferencias: 0,
        penales: 0,
        partidosCalculados: 0,
      }
    );
  }, [rankingEliminatoria]);

  const cargando = cargandoUsuarios || cargandoPredicciones;
  const lider = rankingEliminatoria[0];

  if (cargando) {
    return <Loader texto="Cargando ranking de eliminatoria..." />;
  }

  return (
    <PageContainer>
      <AppHeader />

      <div className="mb-8">
        <p className="text-sm font-semibold text-blue-600">
          Tabla de posiciones
        </p>

        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
          Ranking eliminatoria
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
          Ranking separado para la ronda eliminatoria. Aquí solo se cuentan los
          puntos obtenidos en partidos de eliminación directa.
        </p>
      </div>

      {mensajeError && (
        <div className="mb-6 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {mensajeError}
        </div>
      )}

      {lider && (
        <Card className="mb-6 bg-gradient-to-r from-amber-500 to-slate-900 text-white">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-100">
                Líder de eliminatoria
              </p>

              <h2 className="mt-2 text-3xl font-black">
                🥇 {lider.nombre || "Sin nombre"}
              </h2>

              <p className="mt-1 text-sm text-amber-100">{lider.email}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white">
                  Exactos: {lider.exactos}
                </span>

                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white">
                  Ganador: {lider.ganadores}
                </span>

                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white">
                  Diferencia: {lider.diferencias}
                </span>

                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white">
                  Penales: {lider.penales}
                </span>
              </div>
            </div>

            <div className="rounded-2xl bg-white/15 px-6 py-5 text-center">
              <p className="text-sm font-semibold text-amber-100">
                Puntos eliminatoria
              </p>

              <p className="mt-1 text-5xl font-black">
                {lider.puntosEliminatoria}
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="p-4">
          <p className="text-xs font-bold uppercase text-slate-500">
            Participantes
          </p>
          <p className="mt-1 text-3xl font-black text-slate-900">
            {rankingEliminatoria.length}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs font-bold uppercase text-slate-500">
            Puntos
          </p>
          <p className="mt-1 text-3xl font-black text-amber-600">
            {resumen.puntos}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs font-bold uppercase text-slate-500">
            Exactos
          </p>
          <p className="mt-1 text-3xl font-black text-green-600">
            {resumen.exactos}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs font-bold uppercase text-slate-500">
            Ganador
          </p>
          <p className="mt-1 text-3xl font-black text-blue-600">
            {resumen.ganadores}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs font-bold uppercase text-slate-500">
            Diferencia
          </p>
          <p className="mt-1 text-3xl font-black text-purple-600">
            {resumen.diferencias}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs font-bold uppercase text-slate-500">
            Penales
          </p>
          <p className="mt-1 text-3xl font-black text-red-600">
            {resumen.penales}
          </p>
        </Card>
      </div>

      <Card>
        {rankingEliminatoria.length === 0 ? (
          <p className="text-slate-600">
            Todavía no hay usuarios registrados.
          </p>
        ) : (
          <>
            <div className="space-y-4 md:hidden">
              {rankingEliminatoria.map((usuario, index) => {
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
                          {usuario.puntosEliminatoria}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-green-50 p-3 text-center">
                        <p className="text-xs font-bold text-green-700">
                          Exactos
                        </p>
                        <p className="text-xl font-black text-green-700">
                          {usuario.exactos}
                        </p>
                        <p className="text-xs font-semibold text-green-600">
                          {usuario.puntosExacto} pts
                        </p>
                      </div>

                      <div className="rounded-xl bg-blue-50 p-3 text-center">
                        <p className="text-xs font-bold text-blue-700">
                          Ganador
                        </p>
                        <p className="text-xl font-black text-blue-700">
                          {usuario.ganadores}
                        </p>
                        <p className="text-xs font-semibold text-blue-600">
                          {usuario.puntosGanador} pts
                        </p>
                      </div>

                      <div className="rounded-xl bg-purple-50 p-3 text-center">
                        <p className="text-xs font-bold text-purple-700">
                          Diferencia
                        </p>
                        <p className="text-xl font-black text-purple-700">
                          {usuario.diferencias}
                        </p>
                        <p className="text-xs font-semibold text-purple-600">
                          {usuario.puntosDiferencia} pts
                        </p>
                      </div>

                      <div className="rounded-xl bg-red-50 p-3 text-center">
                        <p className="text-xs font-bold text-red-700">
                          Penales
                        </p>
                        <p className="text-xl font-black text-red-700">
                          {usuario.penales}
                        </p>
                        <p className="text-xs font-semibold text-red-600">
                          {usuario.puntosPenales} pts
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-center">
                      <p className="text-xs font-bold uppercase text-slate-500">
                        Partidos calculados
                      </p>
                      <p className="text-lg font-black text-slate-900">
                        {usuario.partidosCalculados}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-3 pr-4 font-semibold">Posición</th>
                    <th className="py-3 pr-4 font-semibold">Participante</th>
                    <th className="py-3 pr-4 font-semibold">Correo</th>
                    <th className="py-3 pr-4 text-center font-semibold">
                      Partidos
                    </th>
                    <th className="py-3 pr-4 text-center font-semibold">
                      Exactos
                    </th>
                    <th className="py-3 pr-4 text-center font-semibold">
                      Ganador
                    </th>
                    <th className="py-3 pr-4 text-center font-semibold">
                      Diferencia
                    </th>
                    <th className="py-3 pr-4 text-center font-semibold">
                      Penales
                    </th>
                    <th className="py-3 pr-4 text-right font-semibold">
                      Total
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {rankingEliminatoria.map((usuario, index) => {
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
                          <span className="font-black text-slate-700">
                            {usuario.partidosCalculados}
                          </span>
                        </td>

                        <td className="py-4 pr-4 text-center">
                          <span className="font-black text-green-700">
                            {usuario.exactos}
                          </span>
                          <p className="text-xs font-semibold text-green-600">
                            {usuario.puntosExacto} pts
                          </p>
                        </td>

                        <td className="py-4 pr-4 text-center">
                          <span className="font-black text-blue-700">
                            {usuario.ganadores}
                          </span>
                          <p className="text-xs font-semibold text-blue-600">
                            {usuario.puntosGanador} pts
                          </p>
                        </td>

                        <td className="py-4 pr-4 text-center">
                          <span className="font-black text-purple-700">
                            {usuario.diferencias}
                          </span>
                          <p className="text-xs font-semibold text-purple-600">
                            {usuario.puntosDiferencia} pts
                          </p>
                        </td>

                        <td className="py-4 pr-4 text-center">
                          <span className="font-black text-red-700">
                            {usuario.penales}
                          </span>
                          <p className="text-xs font-semibold text-red-600">
                            {usuario.puntosPenales} pts
                          </p>
                        </td>

                        <td className="py-4 pr-4 text-right">
                          <span className="text-2xl font-black text-slate-900">
                            {usuario.puntosEliminatoria}
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