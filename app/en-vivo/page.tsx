"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Timestamp,
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import AppHeader from "@/components/AppHeader";
import PageContainer from "@/components/ui/PageContainer";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Loader from "@/components/ui/Loader";

type EquipoGanador = "LOCAL" | "VISITANTE" | null;

type TipoPartido = "grupos" | "eliminatoria";

type Partido = {
  id: string;
  equipoLocal: string;
  equipoVisitante: string;
  fecha: Timestamp;
  fase: string;
  grupo: string;
  ronda?: string | null;
  tipoPartido?: TipoPartido;
  estado: "programado" | "en_juego" | "finalizado";
  golesLocal: number | null;
  golesVisitante: number | null;
  ganadorPenales?: EquipoGanador;
  clasificado?: EquipoGanador;
};

type Prediccion = {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  matchId: string;
  equipoLocal: string;
  equipoVisitante: string;

  tipoPartido?: TipoPartido;

  golesLocalPredicho: number;
  golesVisitantePredicho: number;

  ganadorPenalesPredicho?: EquipoGanador;
  ganadorPenalesReal?: EquipoGanador;
  clasificadoReal?: EquipoGanador;

  puntos?: number;
  puntosEliminatoria?: number;
  puntosExacto?: number;
  puntosGanador?: number;
  puntosDiferencia?: number;
  puntosPenales?: number;
};

type ResultadoAgrupado = {
  exactas: Prediccion[];
  resultado: Prediccion[];
  perdidas: Prediccion[];
};

const DURACION_ESTIMADA_PARTIDO_MS = 2.5 * 60 * 60 * 1000;

export default function EnVivoPage() {
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [predicciones, setPredicciones] = useState<Prediccion[]>([]);
  const [cargandoPartidos, setCargandoPartidos] = useState(true);
  const [cargandoPredicciones, setCargandoPredicciones] = useState(true);
  const [ahora, setAhora] = useState(new Date());
  const [fechaSeleccionada, setFechaSeleccionada] = useState("");

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

  useEffect(() => {
    const prediccionesQuery = query(collection(db, "predictions"));

    const unsubscribe = onSnapshot(
      prediccionesQuery,
      (snapshot) => {
        const lista = snapshot.docs.map((documento) => ({
          id: documento.id,
          ...documento.data(),
        })) as Prediccion[];

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
  }, []);

  const fechasDisponibles = useMemo(() => {
    return Array.from(
      new Set(
        partidos.map((partido) => obtenerFechaInput(partido.fecha.toDate()))
      )
    ).sort();
  }, [partidos]);

  useEffect(() => {
    if (fechaSeleccionada || fechasDisponibles.length === 0) {
      return;
    }

    const hoy = obtenerFechaInput(new Date());

    if (fechasDisponibles.includes(hoy)) {
      setFechaSeleccionada(hoy);
      return;
    }

    const proximaFecha = fechasDisponibles.find((fecha) => fecha > hoy);

    setFechaSeleccionada(proximaFecha ?? fechasDisponibles[0]);
  }, [fechaSeleccionada, fechasDisponibles]);

  const partidosDelDia = useMemo(() => {
    return partidos.filter(
      (partido) =>
        obtenerFechaInput(partido.fecha.toDate()) === fechaSeleccionada
    );
  }, [partidos, fechaSeleccionada]);

  const prediccionesPorPartido = useMemo(() => {
    const mapa = new Map<string, Prediccion[]>();

    predicciones.forEach((prediccion) => {
      const actuales = mapa.get(prediccion.matchId) ?? [];
      actuales.push(prediccion);
      mapa.set(prediccion.matchId, actuales);
    });

    mapa.forEach((lista) => {
      lista.sort((a, b) => obtenerNombre(a).localeCompare(obtenerNombre(b)));
    });

    return mapa;
  }, [predicciones]);

  const resumenDia = useMemo(() => {
    let totalPredicciones = 0;
    let finalizados = 0;
    let enJuego = 0;
    let pendientes = 0;

    partidosDelDia.forEach((partido) => {
      totalPredicciones += prediccionesPorPartido.get(partido.id)?.length ?? 0;

      if (partido.estado === "finalizado") {
        finalizados++;
      } else if (estaEnJuego(partido)) {
        enJuego++;
      } else {
        pendientes++;
      }
    });

    return {
      totalPredicciones,
      finalizados,
      enJuego,
      pendientes,
    };
  }, [partidosDelDia, prediccionesPorPartido, ahora]);

  function obtenerFechaInput(fecha: Date) {
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, "0");
    const day = String(fecha.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function formatearFechaDia(fechaInput: string) {
    if (!fechaInput) {
      return "Sin fecha";
    }

    const [year, month, day] = fechaInput.split("-").map(Number);
    const fecha = new Date(year, month - 1, day);

    return fecha.toLocaleDateString("es-HN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function formatearHora(fecha: Timestamp) {
    return fecha.toDate().toLocaleTimeString("es-HN", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function obtenerNombre(prediccion: Prediccion) {
    return prediccion.userName || prediccion.userEmail || "Participante";
  }

  function obtenerSigno(golesLocal: number, golesVisitante: number) {
    if (golesLocal > golesVisitante) return "LOCAL";
    if (golesLocal < golesVisitante) return "VISITANTE";
    return "EMPATE";
  }

  function calcularPuntos(partido: Partido, prediccion: Prediccion) {
    if (partido.golesLocal === null || partido.golesVisitante === null) {
      return 0;
    }

    if (partido.tipoPartido === "eliminatoria") {
      return prediccion.puntosEliminatoria ?? prediccion.puntos ?? 0;
    }

    const exacta =
      partido.golesLocal === prediccion.golesLocalPredicho &&
      partido.golesVisitante === prediccion.golesVisitantePredicho;

    if (exacta) {
      return 3;
    }

    const signoReal = obtenerSigno(partido.golesLocal, partido.golesVisitante);
    const signoPredicho = obtenerSigno(
      prediccion.golesLocalPredicho,
      prediccion.golesVisitantePredicho
    );

    if (signoReal === signoPredicho) {
      return 1;
    }

    return 0;
  }

  function agruparResultados(
    partido: Partido,
    prediccionesPartido: Prediccion[]
  ): ResultadoAgrupado {
    const exactas: Prediccion[] = [];
    const resultado: Prediccion[] = [];
    const perdidas: Prediccion[] = [];

    prediccionesPartido.forEach((prediccion) => {
      if (partido.tipoPartido === "eliminatoria") {
        const puntosEliminatoria =
          prediccion.puntosEliminatoria ?? prediccion.puntos ?? 0;

        if ((prediccion.puntosExacto ?? 0) > 0) {
          exactas.push(prediccion);
        } else if (puntosEliminatoria > 0) {
          resultado.push(prediccion);
        } else {
          perdidas.push(prediccion);
        }

        return;
      }

      const puntos = calcularPuntos(partido, prediccion);

      if (puntos === 3) {
        exactas.push(prediccion);
      } else if (puntos === 1) {
        resultado.push(prediccion);
      } else {
        perdidas.push(prediccion);
      }
    });

    return {
      exactas,
      resultado,
      perdidas,
    };
  }

  function estaEnJuego(partido: Partido) {
    if (partido.estado === "en_juego") {
      return true;
    }

    if (partido.estado === "finalizado") {
      return false;
    }

    const inicio = partido.fecha.toDate();
    const finEstimado = new Date(
      inicio.getTime() + DURACION_ESTIMADA_PARTIDO_MS
    );

    return ahora >= inicio && ahora <= finEstimado;
  }

  function partidoYaPaso(partido: Partido) {
    if (partido.estado === "finalizado") {
      return true;
    }

    const inicio = partido.fecha.toDate();
    const finEstimado = new Date(
      inicio.getTime() + DURACION_ESTIMADA_PARTIDO_MS
    );

    return ahora > finEstimado;
  }

  function partidoTieneResultado(partido: Partido) {
    return partido.golesLocal !== null && partido.golesVisitante !== null;
  }

  function obtenerEstadoPartido(partido: Partido) {
    if (partido.estado === "finalizado") {
      return {
        texto: "Finalizado",
        variant: "green" as const,
      };
    }

    if (estaEnJuego(partido)) {
      return {
        texto: "En juego",
        variant: "red" as const,
      };
    }

    if (partidoYaPaso(partido)) {
      return {
        texto: "Pendiente resultado",
        variant: "amber" as const,
      };
    }

    return {
      texto: "Por jugar",
      variant: "blue" as const,
    };
  }

  function obtenerEtiquetaTipoPartido(partido: Partido) {
    if (partido.tipoPartido === "eliminatoria") {
      return partido.ronda ?? "Eliminatoria";
    }

    return partido.grupo;
  }

  function obtenerTextoClasificado(partido: Partido) {
    if (!partido.clasificado) {
      return null;
    }

    return partido.clasificado === "LOCAL"
      ? partido.equipoLocal
      : partido.equipoVisitante;
  }

  function obtenerPuntosPrediccion(partido: Partido, prediccion: Prediccion) {
    if (partido.tipoPartido === "eliminatoria") {
      return prediccion.puntosEliminatoria ?? prediccion.puntos ?? 0;
    }

    return calcularPuntos(partido, prediccion);
  }

  function obtenerDetallePuntosEliminatoria(prediccion: Prediccion) {
    const detalles: string[] = [];

    if ((prediccion.puntosExacto ?? 0) > 0) {
      detalles.push(`Exacto ${prediccion.puntosExacto} pts`);
    }

    if ((prediccion.puntosGanador ?? 0) > 0) {
      detalles.push(`Ganador ${prediccion.puntosGanador} pts`);
    }

    if ((prediccion.puntosDiferencia ?? 0) > 0) {
      detalles.push(`Diferencia ${prediccion.puntosDiferencia} pts`);
    }

    if ((prediccion.puntosPenales ?? 0) > 0) {
      detalles.push(`Penales ${prediccion.puntosPenales} pts`);
    }

    return detalles;
  }

  function PrediccionMiniCard({
    partido,
    prediccion,
    puntos,
  }: {
    partido: Partido;
    prediccion: Prediccion;
    puntos?: number;
  }) {
    const totalPuntos =
      puntos !== undefined ? puntos : obtenerPuntosPrediccion(partido, prediccion);

    const detallesEliminatoria =
      partido.tipoPartido === "eliminatoria"
        ? obtenerDetallePuntosEliminatoria(prediccion)
        : [];

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-slate-900">
              {obtenerNombre(prediccion)}
            </p>

            {prediccion.userEmail && (
              <p className="mt-1 truncate text-xs text-slate-500">
                {prediccion.userEmail}
              </p>
            )}
          </div>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
            {totalPuntos} pts
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-100 px-4 py-3">
          <span className="text-xs font-bold text-slate-500">Predicción</span>
          <span className="text-xl font-black text-slate-900">
            {prediccion.golesLocalPredicho} -{" "}
            {prediccion.golesVisitantePredicho}
          </span>
        </div>

        {partido.tipoPartido === "eliminatoria" &&
          prediccion.ganadorPenalesPredicho && (
            <div className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
              Penales predicho:{" "}
              {prediccion.ganadorPenalesPredicho === "LOCAL"
                ? partido.equipoLocal
                : partido.equipoVisitante}
            </div>
          )}

        {detallesEliminatoria.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {detallesEliminatoria.map((detalle) => (
              <span
                key={detalle}
                className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700"
              >
                {detalle}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  function PartidoCard({ partido }: { partido: Partido }) {
    const prediccionesPartido = prediccionesPorPartido.get(partido.id) ?? [];
    const estado = obtenerEstadoPartido(partido);
    const puedeClasificar = partidoTieneResultado(partido);
    const grupos = agruparResultados(partido, prediccionesPartido);

    const totalExactas = grupos.exactas.length;
    const totalResultado = grupos.resultado.length;
    const totalPerdidas = grupos.perdidas.length;
    const textoClasificado = obtenerTextoClasificado(partido);
    const esEliminatoria = partido.tipoPartido === "eliminatoria";

    return (
      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-200 bg-slate-50 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={estado.variant}>{estado.texto}</Badge>
                <Badge>{obtenerEtiquetaTipoPartido(partido)}</Badge>
                <Badge>{esEliminatoria ? "Eliminatoria" : "Grupos"}</Badge>
                <Badge>{formatearHora(partido.fecha)}</Badge>
              </div>

              <h2 className="mt-3 text-2xl font-black leading-tight text-slate-900">
                {partido.equipoLocal} vs {partido.equipoVisitante}
              </h2>
            </div>

            <div className="rounded-2xl bg-white px-4 py-3 text-center shadow-sm ring-1 ring-slate-200">
              <p className="text-xs font-bold uppercase text-slate-500">
                Predicciones
              </p>
              <p className="text-3xl font-black text-slate-900">
                {prediccionesPartido.length}
              </p>
            </div>
          </div>

          {partidoTieneResultado(partido) && (
            <div className="mt-4 rounded-2xl bg-slate-900 px-4 py-3 text-white">
              <p className="text-xs font-bold uppercase text-slate-300">
                Resultado final
              </p>

              <p className="mt-1 text-3xl font-black">
                {partido.golesLocal} - {partido.golesVisitante}
              </p>

              {esEliminatoria && partido.ganadorPenales && (
                <p className="mt-1 text-xs font-semibold text-amber-200">
                  Ganador por penales:{" "}
                  {partido.ganadorPenales === "LOCAL"
                    ? partido.equipoLocal
                    : partido.equipoVisitante}
                </p>
              )}

              {esEliminatoria && textoClasificado && (
                <p className="mt-1 text-xs font-semibold text-slate-300">
                  Clasifica: {textoClasificado}
                </p>
              )}
            </div>
          )}

          {!partidoTieneResultado(partido) && partidoYaPaso(partido) && (
            <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
              Este partido ya pasó, pero todavía no tiene resultado cargado.
            </div>
          )}
        </div>

        <div className="p-4 sm:p-5">
          {prediccionesPartido.length === 0 ? (
            <p className="text-sm text-slate-600">
              No hay predicciones registradas para este partido.
            </p>
          ) : !puedeClasificar ? (
            <div>
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">
                Predicciones registradas
              </h3>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {prediccionesPartido.map((prediccion) => (
                  <PrediccionMiniCard
                    key={prediccion.id}
                    partido={partido}
                    prediccion={prediccion}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-green-50 p-3 text-center">
                  <p className="text-xs font-bold text-green-700">
                    {esEliminatoria ? "Exactas" : "Exactas"}
                  </p>
                  <p className="text-2xl font-black text-green-700">
                    {totalExactas}
                  </p>
                </div>

                <div className="rounded-2xl bg-blue-50 p-3 text-center">
                  <p className="text-xs font-bold text-blue-700">
                    {esEliminatoria ? "Sumaron" : "Resultado"}
                  </p>
                  <p className="text-2xl font-black text-blue-700">
                    {totalResultado}
                  </p>
                </div>

                <div className="rounded-2xl bg-red-50 p-3 text-center">
                  <p className="text-xs font-bold text-red-700">Perdieron</p>
                  <p className="text-2xl font-black text-red-700">
                    {totalPerdidas}
                  </p>
                </div>
              </div>

              {grupos.exactas.length > 0 && (
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <Badge variant="green">Mejor predicción</Badge>
                    <h3 className="text-base font-black text-slate-900">
                      Marcador exacto
                    </h3>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {grupos.exactas.map((prediccion) => (
                      <PrediccionMiniCard
                        key={prediccion.id}
                        partido={partido}
                        prediccion={prediccion}
                        puntos={obtenerPuntosPrediccion(partido, prediccion)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {grupos.resultado.length > 0 && (
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <Badge variant="blue">
                      {esEliminatoria
                        ? "Sumaron puntos"
                        : "Adivinaron resultado"}
                    </Badge>

                    <h3 className="text-base font-black text-slate-900">
                      {esEliminatoria
                        ? "Ganador, diferencia o penales"
                        : "Ganador o empate correcto"}
                    </h3>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {grupos.resultado.map((prediccion) => (
                      <PrediccionMiniCard
                        key={prediccion.id}
                        partido={partido}
                        prediccion={prediccion}
                        puntos={obtenerPuntosPrediccion(partido, prediccion)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {grupos.perdidas.length > 0 && (
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <Badge variant="red">Perdieron</Badge>
                    <h3 className="text-base font-black text-slate-900">
                      No sumaron puntos
                    </h3>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {grupos.perdidas.map((prediccion) => (
                      <PrediccionMiniCard
                        key={prediccion.id}
                        partido={partido}
                        prediccion={prediccion}
                        puntos={0}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </Card>
    );
  }

  if (cargandoPartidos || cargandoPredicciones) {
    return <Loader texto="Cargando partidos del día..." />;
  }

  return (
    <PageContainer>
      <AppHeader />

      <div className="mb-6">
        <p className="text-sm font-semibold text-blue-600">
          Quiniela Mundial
        </p>

        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
          Partidos del día
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
          Revisa las predicciones de todos los participantes para cada partido
          del día. La vista soporta fase de grupos y ronda eliminatoria.
        </p>
      </div>

      <Card className="mb-5 p-4 sm:p-5">
        <label
          htmlFor="fecha"
          className="block text-sm font-black text-slate-700"
        >
          Fecha de partidos
        </label>

        <select
          id="fecha"
          value={fechaSeleccionada}
          onChange={(event) => setFechaSeleccionada(event.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        >
          {fechasDisponibles.map((fecha) => (
            <option key={fecha} value={fecha}>
              {formatearFechaDia(fecha)}
            </option>
          ))}
        </select>
      </Card>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-bold uppercase text-slate-500">
            Partidos
          </p>
          <p className="mt-1 text-3xl font-black text-slate-900">
            {partidosDelDia.length}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs font-bold uppercase text-slate-500">
            En juego
          </p>
          <p className="mt-1 text-3xl font-black text-red-600">
            {resumenDia.enJuego}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs font-bold uppercase text-slate-500">
            Finalizados
          </p>
          <p className="mt-1 text-3xl font-black text-green-600">
            {resumenDia.finalizados}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs font-bold uppercase text-slate-500">
            Predicciones
          </p>
          <p className="mt-1 text-3xl font-black text-blue-600">
            {resumenDia.totalPredicciones}
          </p>
        </Card>
      </div>

      {partidosDelDia.length === 0 ? (
        <Card>
          <h2 className="text-xl font-black text-slate-900">
            No hay partidos para esta fecha
          </h2>

          <p className="mt-2 text-slate-600">
            Selecciona otra fecha disponible para revisar los partidos y sus
            predicciones.
          </p>
        </Card>
      ) : (
        <div className="grid gap-5">
          {partidosDelDia.map((partido) => (
            <PartidoCard key={partido.id} partido={partido} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}