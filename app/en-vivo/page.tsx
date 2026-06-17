"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Timestamp,
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import AppHeader from "@/components/AppHeader";
import PageContainer from "@/components/ui/PageContainer";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Loader from "@/components/ui/Loader";

type Partido = {
  id: string;
  equipoLocal: string;
  equipoVisitante: string;
  fecha: Timestamp;
  fase: string;
  grupo: string;
  estado: "programado" | "en_juego" | "finalizado";
  golesLocal: number | null;
  golesVisitante: number | null;
};

type PrediccionEnVivo = {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  matchId: string;
  equipoLocal: string;
  equipoVisitante: string;
  golesLocalPredicho: number;
  golesVisitantePredicho: number;
  puntos?: number;
};

const DURACION_ESTIMADA_PARTIDO_MS = 2.5 * 60 * 60 * 1000;

export default function EnVivoPage() {
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [predicciones, setPredicciones] = useState<PrediccionEnVivo[]>([]);
  const [cargandoPartidos, setCargandoPartidos] = useState(true);
  const [cargandoPredicciones, setCargandoPredicciones] = useState(false);
  const [ahora, setAhora] = useState(new Date());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setAhora(new Date());
    }, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const partidosQuery = query(
      collection(db, "matches"),
      orderBy("fecha", "asc")
    );

    const unsubscribe = onSnapshot(
      partidosQuery,
      (snapshot) => {
        const lista = snapshot.docs.map((documento) => ({
          id: documento.id,
          ...documento.data(),
        })) as Partido[];

        setPartidos(lista);
        setCargandoPartidos(false);
      },
      (error) => {
        console.error(error);
        setCargandoPartidos(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const partidoSeleccionado = useMemo(() => {
    if (partidos.length === 0) {
      return null;
    }

    const partidoMarcadoEnJuego = partidos.find(
      (partido) => partido.estado === "en_juego"
    );

    if (partidoMarcadoEnJuego) {
      return partidoMarcadoEnJuego;
    }

    const partidoPorHorario = partidos.find((partido) => {
      if (partido.estado === "finalizado") {
        return false;
      }

      const fechaPartido = partido.fecha.toDate();
      const finEstimado = new Date(
        fechaPartido.getTime() + DURACION_ESTIMADA_PARTIDO_MS
      );

      return ahora >= fechaPartido && ahora <= finEstimado;
    });

    if (partidoPorHorario) {
      return partidoPorHorario;
    }

    const proximoPartido = partidos.find((partido) => {
      if (partido.estado === "finalizado") {
        return false;
      }

      return partido.fecha.toDate() > ahora;
    });

    return proximoPartido ?? partidos[partidos.length - 1];
  }, [partidos, ahora]);

  useEffect(() => {
    if (!partidoSeleccionado) {
      setPredicciones([]);
      return;
    }

    setCargandoPredicciones(true);

    const prediccionesQuery = query(
      collection(db, "predictions"),
      where("matchId", "==", partidoSeleccionado.id)
    );

    const unsubscribe = onSnapshot(
      prediccionesQuery,
      (snapshot) => {
        const lista = snapshot.docs.map((documento) => ({
          id: documento.id,
          ...documento.data(),
        })) as PrediccionEnVivo[];

        lista.sort((a, b) => {
          const nombreA = a.userName || a.userEmail || "";
          const nombreB = b.userName || b.userEmail || "";
          return nombreA.localeCompare(nombreB);
        });

        setPredicciones(lista);
        setCargandoPredicciones(false);
      },
      (error) => {
        console.error(error);
        setPredicciones([]);
        setCargandoPredicciones(false);
      }
    );

    return () => unsubscribe();
  }, [partidoSeleccionado]);

  function formatearFecha(fecha: Timestamp) {
    return fecha.toDate().toLocaleString("es-HN", {
      dateStyle: "full",
      timeStyle: "short",
    });
  }

  function partidoYaInicio(partido: Partido) {
    return ahora >= partido.fecha.toDate();
  }

  function obtenerEstadoVisual(partido: Partido) {
    if (partido.estado === "finalizado") {
      return {
        texto: "Finalizado",
        variant: "green" as const,
      };
    }

    if (partido.estado === "en_juego") {
      return {
        texto: "En juego",
        variant: "red" as const,
      };
    }

    if (partidoYaInicio(partido)) {
      return {
        texto: "En juego por horario",
        variant: "red" as const,
      };
    }

    return {
      texto: "Próximo partido",
      variant: "blue" as const,
    };
  }

  function obtenerSigno(golesLocal: number, golesVisitante: number) {
    if (golesLocal > golesVisitante) return "Gana local";
    if (golesLocal < golesVisitante) return "Gana visitante";
    return "Empate";
  }

  const resumen = useMemo(() => {
    const total = predicciones.length;

    const local = predicciones.filter(
      (prediccion) =>
        prediccion.golesLocalPredicho > prediccion.golesVisitantePredicho
    ).length;

    const empate = predicciones.filter(
      (prediccion) =>
        prediccion.golesLocalPredicho === prediccion.golesVisitantePredicho
    ).length;

    const visitante = predicciones.filter(
      (prediccion) =>
        prediccion.golesLocalPredicho < prediccion.golesVisitantePredicho
    ).length;

    return {
      total,
      local,
      empate,
      visitante,
    };
  }, [predicciones]);

  if (cargandoPartidos) {
    return <Loader texto="Cargando partido en vivo..." />;
  }

  if (!partidoSeleccionado) {
    return (
      <PageContainer>
        <AppHeader />

        <Card>
          <h1 className="text-2xl font-black text-slate-900">
            No hay partidos cargados
          </h1>

          <p className="mt-2 text-slate-600">
            Todavía no existen partidos en la colección matches.
          </p>
        </Card>
      </PageContainer>
    );
  }

  const estadoVisual = obtenerEstadoVisual(partidoSeleccionado);
  const mostrarPredicciones = partidoYaInicio(partidoSeleccionado);

  return (
    <PageContainer>
      <AppHeader />

      <div className="mb-8">
        <p className="text-sm font-semibold text-blue-600">
          Quiniela Mundial
        </p>

        <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">
          Predicciones del partido
        </h1>

        <p className="mt-2 max-w-2xl text-slate-600">
          Visualiza las predicciones de todos los participantes para el partido
          actual. La pantalla cambia automáticamente según el próximo juego.
        </p>
      </div>

      <Card className="mb-6 border-blue-200 bg-gradient-to-r from-slate-900 to-blue-700 p-6 text-white">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={estadoVisual.variant}>{estadoVisual.texto}</Badge>
              <Badge>{partidoSeleccionado.grupo}</Badge>
              <Badge>{partidoSeleccionado.fase}</Badge>
            </div>

            <h2 className="mt-4 text-4xl font-black">
              {partidoSeleccionado.equipoLocal} vs{" "}
              {partidoSeleccionado.equipoVisitante}
            </h2>

            <p className="mt-2 text-sm font-medium text-blue-100">
              {formatearFecha(partidoSeleccionado.fecha)}
            </p>
          </div>

          <div className="rounded-2xl bg-white/15 px-6 py-5 text-center backdrop-blur">
            <p className="text-sm font-semibold text-blue-100">
              Predicciones registradas
            </p>
            <p className="mt-1 text-5xl font-black">{resumen.total}</p>
          </div>
        </div>
      </Card>

      {!mostrarPredicciones ? (
        <Card>
          <h2 className="text-2xl font-black text-slate-900">
            Las predicciones se mostrarán cuando inicie el partido
          </h2>

          <p className="mt-2 text-slate-600">
            Por ahora esta pantalla está mostrando el próximo juego disponible.
            Cuando llegue la hora del partido, aquí aparecerán las predicciones
            de todos los participantes.
          </p>
        </Card>
      ) : (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <Card className="p-5">
              <p className="text-sm font-semibold text-slate-500">
                Total predicciones
              </p>
              <p className="mt-1 text-3xl font-black text-slate-900">
                {resumen.total}
              </p>
            </Card>

            <Card className="p-5">
              <p className="text-sm font-semibold text-slate-500">
                Gana {partidoSeleccionado.equipoLocal}
              </p>
              <p className="mt-1 text-3xl font-black text-blue-600">
                {resumen.local}
              </p>
            </Card>

            <Card className="p-5">
              <p className="text-sm font-semibold text-slate-500">Empate</p>
              <p className="mt-1 text-3xl font-black text-amber-600">
                {resumen.empate}
              </p>
            </Card>

            <Card className="p-5">
              <p className="text-sm font-semibold text-slate-500">
                Gana {partidoSeleccionado.equipoVisitante}
              </p>
              <p className="mt-1 text-3xl font-black text-green-600">
                {resumen.visitante}
              </p>
            </Card>
          </div>

          <Card>
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-900">
                  Predicciones de participantes
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Marcadores registrados para este partido.
                </p>
              </div>

              {cargandoPredicciones && (
                <p className="text-sm font-semibold text-slate-500">
                  Actualizando...
                </p>
              )}
            </div>

            {predicciones.length === 0 ? (
              <p className="text-slate-600">
                Todavía no hay predicciones registradas para este partido.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-3 pr-4 font-semibold">
                        Participante
                      </th>
                      <th className="py-3 pr-4 font-semibold">
                        Predicción
                      </th>
                      <th className="py-3 pr-4 font-semibold">
                        Tendencia
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {predicciones.map((prediccion) => (
                      <tr
                        key={prediccion.id}
                        className="border-b border-slate-100 text-slate-700 last:border-b-0 hover:bg-slate-50"
                      >
                        <td className="py-4 pr-4">
                          <p className="font-bold text-slate-900">
                            {prediccion.userName ||
                              prediccion.userEmail ||
                              "Participante"}
                          </p>

                          {prediccion.userEmail && (
                            <p className="mt-1 text-xs text-slate-500">
                              {prediccion.userEmail}
                            </p>
                          )}
                        </td>

                        <td className="py-4 pr-4">
                          <span className="rounded-xl bg-slate-100 px-4 py-2 text-lg font-black text-slate-900">
                            {prediccion.golesLocalPredicho} -{" "}
                            {prediccion.golesVisitantePredicho}
                          </span>
                        </td>

                        <td className="py-4 pr-4">
                          <Badge>
                            {obtenerSigno(
                              prediccion.golesLocalPredicho,
                              prediccion.golesVisitantePredicho
                            )}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </PageContainer>
  );
}