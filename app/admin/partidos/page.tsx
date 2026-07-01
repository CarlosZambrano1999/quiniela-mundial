"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/context/AuthContext";
import Loader from "@/components/ui/Loader";
import PageContainer from "@/components/ui/PageContainer";
import AppHeader from "@/components/AppHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { calcularPuntosEliminatoria } from "@/lib/calcularPuntosEliminatoria";

type EquipoGanador = "LOCAL" | "VISITANTE" | null;

type TipoPartido = "grupos" | "eliminatoria";

type EstadoPartido = "programado" | "en_juego" | "finalizado";

type FiltroEstado = "todos" | "pendientes" | "programado" | "en_juego" | "finalizado";

type FiltroTipo = "todos" | TipoPartido;

type Partido = {
  id: string;
  equipoLocal: string;
  equipoVisitante: string;
  fecha: Timestamp;
  fase: string;
  grupo: string;
  ronda?: string | null;
  tipoPartido?: TipoPartido;
  estado: EstadoPartido;
  golesLocal: number | null;
  golesVisitante: number | null;
  permitePenales?: boolean;
  ganadorPenales?: EquipoGanador;
  clasificado?: EquipoGanador;
};

type ResultadoTemporal = {
  golesLocal: string;
  golesVisitante: string;
  ganadorPenales: EquipoGanador;
};

const GRUPOS = [
  "Grupo A",
  "Grupo B",
  "Grupo C",
  "Grupo D",
  "Grupo E",
  "Grupo F",
  "Grupo G",
  "Grupo H",
  "Grupo I",
  "Grupo J",
  "Grupo K",
  "Grupo L",
];

const RONDAS_ELIMINATORIAS = [
  "Dieciseisavos",
  "Octavos",
  "Cuartos",
  "Semifinal",
  "Tercer lugar",
  "Final",
];

export default function AdminPartidosPage() {
  const router = useRouter();
  const { usuario, perfil, cargando } = useAuth();

  const [equipoLocal, setEquipoLocal] = useState("");
  const [equipoVisitante, setEquipoVisitante] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");

  const [tipoPartido, setTipoPartido] = useState<TipoPartido>("grupos");
  const [fase, setFase] = useState("Grupos");
  const [grupo, setGrupo] = useState("Grupo A");
  const [ronda, setRonda] = useState("Dieciseisavos");

  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [mensajeError, setMensajeError] = useState("");
  const [mensajeExito, setMensajeExito] = useState("");

  const [resultados, setResultados] = useState<Record<string, ResultadoTemporal>>({});
  const [finalizandoId, setFinalizandoId] = useState<string | null>(null);

  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("pendientes");
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("todos");
  const [filtroFecha, setFiltroFecha] = useState("");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    if (!cargando && !usuario) {
      router.push("/login");
      return;
    }

    if (!cargando && usuario && perfil && perfil.rol !== "admin") {
      router.push("/quiniela");
    }
  }, [usuario, perfil, cargando, router]);

  useEffect(() => {
    if (!usuario || !perfil || perfil.rol !== "admin") {
      return;
    }

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
      },
      (error) => {
        console.error(error);
        setMensajeError("No se pudieron cargar los partidos.");
      }
    );

    return () => unsubscribe();
  }, [usuario, perfil]);

  const partidosOrdenadosFiltrados = useMemo(() => {
    const textoBusqueda = busqueda.trim().toLowerCase();

    return partidos
      .filter((partido) => {
        const tipo = obtenerTipoPartido(partido);

        if (filtroTipo !== "todos" && tipo !== filtroTipo) {
          return false;
        }

        if (filtroEstado === "pendientes" && partido.estado === "finalizado") {
          return false;
        }

        if (
          filtroEstado !== "todos" &&
          filtroEstado !== "pendientes" &&
          partido.estado !== filtroEstado
        ) {
          return false;
        }

        if (filtroFecha) {
          const fechaPartido = obtenerFechaInput(partido.fecha.toDate());

          if (fechaPartido !== filtroFecha) {
            return false;
          }
        }

        if (textoBusqueda) {
          const textoPartido = `${partido.equipoLocal} ${partido.equipoVisitante} ${partido.grupo} ${partido.ronda ?? ""}`.toLowerCase();

          if (!textoPartido.includes(textoBusqueda)) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const pesoEstadoA = obtenerPesoEstado(a.estado);
        const pesoEstadoB = obtenerPesoEstado(b.estado);

        if (pesoEstadoA !== pesoEstadoB) {
          return pesoEstadoA - pesoEstadoB;
        }

        return a.fecha.toDate().getTime() - b.fecha.toDate().getTime();
      });
  }, [partidos, filtroTipo, filtroEstado, filtroFecha, busqueda]);

  const resumen = useMemo(() => {
    const total = partidos.length;
    const pendientes = partidos.filter((p) => p.estado !== "finalizado").length;
    const finalizados = partidos.filter((p) => p.estado === "finalizado").length;
    const eliminatoria = partidos.filter(
      (p) => obtenerTipoPartido(p) === "eliminatoria"
    ).length;

    return {
      total,
      pendientes,
      finalizados,
      eliminatoria,
    };
  }, [partidos]);

  async function manejarGuardarPartido(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMensajeError("");
    setMensajeExito("");

    if (!equipoLocal.trim() || !equipoVisitante.trim() || !fecha || !hora) {
      setMensajeError("Completa todos los campos obligatorios.");
      return;
    }

    if (equipoLocal.trim().toLowerCase() === equipoVisitante.trim().toLowerCase()) {
      setMensajeError("El equipo local y visitante no pueden ser iguales.");
      return;
    }

    setGuardando(true);

    try {
      const fechaPartido = new Date(`${fecha}T${hora}:00`);

      await addDoc(collection(db, "matches"), {
        equipoLocal: equipoLocal.trim(),
        equipoVisitante: equipoVisitante.trim(),
        fecha: Timestamp.fromDate(fechaPartido),

        fase: tipoPartido === "eliminatoria" ? "Eliminatoria" : fase,
        grupo: tipoPartido === "eliminatoria" ? "No aplica" : grupo,
        ronda: tipoPartido === "eliminatoria" ? ronda : null,
        tipoPartido,
        permitePenales: tipoPartido === "eliminatoria",

        estado: "programado",
        golesLocal: null,
        golesVisitante: null,
        ganadorPenales: null,
        clasificado: null,

        creadoEn: serverTimestamp(),
        actualizadoEn: serverTimestamp(),
      });

      limpiarFormularioPartido();
      setMensajeExito("Partido creado correctamente.");
    } catch (error) {
      console.error(error);
      setMensajeError("No se pudo guardar el partido.");
    } finally {
      setGuardando(false);
    }
  }

  function limpiarFormularioPartido() {
    setEquipoLocal("");
    setEquipoVisitante("");
    setFecha("");
    setHora("");
    setTipoPartido("grupos");
    setFase("Grupos");
    setGrupo("Grupo A");
    setRonda("Dieciseisavos");
  }

  function obtenerTipoPartido(partido: Partido): TipoPartido {
    return partido.tipoPartido === "eliminatoria" ? "eliminatoria" : "grupos";
  }

  function obtenerPesoEstado(estado: EstadoPartido) {
    if (estado === "en_juego") return 1;
    if (estado === "programado") return 2;
    return 3;
  }

  function obtenerFechaInput(fechaDate: Date) {
    const year = fechaDate.getFullYear();
    const month = String(fechaDate.getMonth() + 1).padStart(2, "0");
    const day = String(fechaDate.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function formatearFecha(fechaPartido: Timestamp) {
    return fechaPartido.toDate().toLocaleString("es-HN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function formatearHora(fechaPartido: Timestamp) {
    return fechaPartido.toDate().toLocaleTimeString("es-HN", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function actualizarResultado(
    matchId: string,
    campo: "golesLocal" | "golesVisitante" | "ganadorPenales",
    valor: string
  ) {
    setMensajeError("");
    setMensajeExito("");

    setResultados((actuales) => {
      const actual = actuales[matchId] ?? {
        golesLocal: "",
        golesVisitante: "",
        ganadorPenales: null,
      };

      return {
        ...actuales,
        [matchId]: {
          ...actual,
          [campo]:
            campo === "ganadorPenales"
              ? valor === ""
                ? null
                : (valor as EquipoGanador)
              : valor,
        },
      };
    });
  }

  function obtenerResultadoTemporal(partidoId: string) {
    return (
      resultados[partidoId] ?? {
        golesLocal: "",
        golesVisitante: "",
        ganadorPenales: null,
      }
    );
  }

  function obtenerSignoPartido(golesLocal: number, golesVisitante: number) {
    if (golesLocal > golesVisitante) {
      return "LOCAL";
    }

    if (golesLocal < golesVisitante) {
      return "VISITANTE";
    }

    return "EMPATE";
  }

  function calcularPuntosGrupos(params: {
    golesLocalReal: number;
    golesVisitanteReal: number;
    golesLocalPredicho: number;
    golesVisitantePredicho: number;
  }) {
    const {
      golesLocalReal,
      golesVisitanteReal,
      golesLocalPredicho,
      golesVisitantePredicho,
    } = params;

    const marcadorExacto =
      golesLocalReal === golesLocalPredicho &&
      golesVisitanteReal === golesVisitantePredicho;

    if (marcadorExacto) {
      return 3;
    }

    const signoReal = obtenerSignoPartido(golesLocalReal, golesVisitanteReal);
    const signoPredicho = obtenerSignoPartido(
      golesLocalPredicho,
      golesVisitantePredicho
    );

    if (signoReal === signoPredicho) {
      return 1;
    }

    return 0;
  }

  function validarResultadoBase(partido: Partido) {
    const resultado = obtenerResultadoTemporal(partido.id);

    if (resultado.golesLocal === "" || resultado.golesVisitante === "") {
      setMensajeError("Debes ingresar el resultado real del partido.");
      return null;
    }

    const golesLocalReal = Number(resultado.golesLocal);
    const golesVisitanteReal = Number(resultado.golesVisitante);

    if (
      Number.isNaN(golesLocalReal) ||
      Number.isNaN(golesVisitanteReal) ||
      golesLocalReal < 0 ||
      golesVisitanteReal < 0
    ) {
      setMensajeError("El resultado debe tener números mayores o iguales a cero.");
      return null;
    }

    return {
      golesLocalReal,
      golesVisitanteReal,
      ganadorPenales: resultado.ganadorPenales,
    };
  }

  async function finalizarPartidoGrupos(partido: Partido) {
    setMensajeError("");
    setMensajeExito("");

    const resultadoValidado = validarResultadoBase(partido);

    if (!resultadoValidado) {
      return;
    }

    const { golesLocalReal, golesVisitanteReal } = resultadoValidado;

    setFinalizandoId(partido.id);

    try {
      const prediccionesQuery = query(
        collection(db, "predictions"),
        where("matchId", "==", partido.id)
      );

      const prediccionesSnapshot = await getDocs(prediccionesQuery);
      const batch = writeBatch(db);
      const puntosNuevosPorUsuario = new Map<string, number>();

      prediccionesSnapshot.docs.forEach((documentoPrediccion) => {
        const prediccion = documentoPrediccion.data() as {
          userId: string;
          golesLocalPredicho: number;
          golesVisitantePredicho: number;
          tipoPartido?: string;
        };

        if (prediccion.tipoPartido === "eliminatoria") {
          return;
        }

        const puntos = calcularPuntosGrupos({
          golesLocalReal,
          golesVisitanteReal,
          golesLocalPredicho: prediccion.golesLocalPredicho,
          golesVisitantePredicho: prediccion.golesVisitantePredicho,
        });

        batch.update(documentoPrediccion.ref, {
          tipoPartido: "grupos",
          puntos,
          golesLocalReal,
          golesVisitanteReal,
          partidoFinalizado: true,
          calculadoEn: serverTimestamp(),
        });

        puntosNuevosPorUsuario.set(prediccion.userId, puntos);
      });

      const usuariosAfectados = [...puntosNuevosPorUsuario.keys()];

      for (const userId of usuariosAfectados) {
        const prediccionesFinalizadasUsuarioQuery = query(
          collection(db, "predictions"),
          where("userId", "==", userId),
          where("partidoFinalizado", "==", true)
        );

        const prediccionesFinalizadasUsuarioSnapshot = await getDocs(
          prediccionesFinalizadasUsuarioQuery
        );

        let puntosTotales = 0;
        let yaIncluyoPartidoActual = false;

        prediccionesFinalizadasUsuarioSnapshot.docs.forEach((documentoPrediccion) => {
          const prediccion = documentoPrediccion.data() as {
            matchId: string;
            puntos?: number;
            tipoPartido?: string;
          };

          if (prediccion.tipoPartido === "eliminatoria") {
            return;
          }

          if (prediccion.matchId === partido.id) {
            puntosTotales += puntosNuevosPorUsuario.get(userId) ?? 0;
            yaIncluyoPartidoActual = true;
          } else {
            puntosTotales += prediccion.puntos ?? 0;
          }
        });

        if (!yaIncluyoPartidoActual) {
          puntosTotales += puntosNuevosPorUsuario.get(userId) ?? 0;
        }

        batch.update(doc(db, "users", userId), {
          puntosTotales,
        });
      }

      batch.update(doc(db, "matches", partido.id), {
        golesLocal: golesLocalReal,
        golesVisitante: golesVisitanteReal,
        ganadorPenales: null,
        clasificado: null,
        estado: "finalizado",
        finalizadoEn: serverTimestamp(),
        actualizadoEn: serverTimestamp(),
      });

      await batch.commit();

      setMensajeExito(
        `Partido de grupos finalizado. Predicciones calculadas: ${prediccionesSnapshot.size}.`
      );
    } catch (error) {
      console.error(error);
      setMensajeError("No se pudo finalizar el partido.");
    } finally {
      setFinalizandoId(null);
    }
  }

  async function finalizarPartidoEliminatoria(partido: Partido) {
    setMensajeError("");
    setMensajeExito("");

    const resultadoValidado = validarResultadoBase(partido);

    if (!resultadoValidado) {
      return;
    }

    const { golesLocalReal, golesVisitanteReal, ganadorPenales } = resultadoValidado;
    const partidoEmpatado = golesLocalReal === golesVisitanteReal;

    if (partidoEmpatado && !ganadorPenales) {
      setMensajeError(
        "El partido terminó empatado. Debes seleccionar quién ganó por penales."
      );
      return;
    }

    const clasificado: EquipoGanador =
      golesLocalReal > golesVisitanteReal
        ? "LOCAL"
        : golesVisitanteReal > golesLocalReal
          ? "VISITANTE"
          : ganadorPenales;

    if (!clasificado) {
      setMensajeError("No se pudo determinar el clasificado.");
      return;
    }

    setFinalizandoId(partido.id);

    try {
      const prediccionesQuery = query(
        collection(db, "predictions"),
        where("matchId", "==", partido.id)
      );

      const prediccionesSnapshot = await getDocs(prediccionesQuery);
      const batch = writeBatch(db);

      prediccionesSnapshot.docs.forEach((documentoPrediccion) => {
        const prediccion = documentoPrediccion.data() as {
          golesLocalPredicho: number;
          golesVisitantePredicho: number;
          ganadorPenalesPredicho?: EquipoGanador;
          tipoPartido?: string;
        };

        const calculo = calcularPuntosEliminatoria({
          golesLocalReal,
          golesVisitanteReal,
          golesLocalPredicho: prediccion.golesLocalPredicho,
          golesVisitantePredicho: prediccion.golesVisitantePredicho,
          ganadorPenalesReal: partidoEmpatado ? ganadorPenales : null,
          ganadorPenalesPredicho: prediccion.ganadorPenalesPredicho ?? null,
        });

        batch.update(documentoPrediccion.ref, {
          tipoPartido: "eliminatoria",

          puntosExacto: calculo.puntosExacto,
          puntosGanador: calculo.puntosGanador,
          puntosDiferencia: calculo.puntosDiferencia,
          puntosPenales: calculo.puntosPenales,
          puntosEliminatoria: calculo.puntosTotales,

          puntos: calculo.puntosTotales,

          golesLocalReal,
          golesVisitanteReal,
          ganadorPenalesReal: partidoEmpatado ? ganadorPenales : null,
          clasificadoReal: clasificado,

          partidoFinalizado: true,
          calculadoEn: serverTimestamp(),
        });
      });

      batch.update(doc(db, "matches", partido.id), {
        golesLocal: golesLocalReal,
        golesVisitante: golesVisitanteReal,
        ganadorPenales: partidoEmpatado ? ganadorPenales : null,
        clasificado,
        estado: "finalizado",
        finalizadoEn: serverTimestamp(),
        actualizadoEn: serverTimestamp(),
      });

      await batch.commit();

      setMensajeExito(
        `Partido eliminatorio finalizado. Predicciones calculadas: ${prediccionesSnapshot.size}.`
      );
    } catch (error) {
      console.error(error);
      setMensajeError("No se pudo finalizar el partido eliminatorio.");
    } finally {
      setFinalizandoId(null);
    }
  }

  function manejarFinalizarPartido(partido: Partido) {
    if (obtenerTipoPartido(partido) === "eliminatoria") {
      finalizarPartidoEliminatoria(partido);
      return;
    }

    finalizarPartidoGrupos(partido);
  }

  function obtenerEstadoBadge(partido: Partido) {
    if (partido.estado === "finalizado") {
      return "green" as const;
    }

    if (partido.estado === "en_juego") {
      return "red" as const;
    }

    return "blue" as const;
  }

  function obtenerTextoClasificado(partido: Partido) {
    if (!partido.clasificado) {
      return "";
    }

    return partido.clasificado === "LOCAL"
      ? partido.equipoLocal
      : partido.equipoVisitante;
  }

  function resultadoTemporalEsEmpate(partido: Partido) {
    const resultado = obtenerResultadoTemporal(partido.id);

    return (
      resultado.golesLocal !== "" &&
      resultado.golesVisitante !== "" &&
      resultado.golesLocal === resultado.golesVisitante
    );
  }

  function limpiarFiltros() {
    setFiltroEstado("pendientes");
    setFiltroTipo("todos");
    setFiltroFecha("");
    setBusqueda("");
  }

  function ResultadoInputs({ partido }: { partido: Partido }) {
    const resultado = obtenerResultadoTemporal(partido.id);
    const esEliminatoria = obtenerTipoPartido(partido) === "eliminatoria";

    if (partido.estado === "finalizado") {
      return (
        <div>
          <span className="font-semibold text-slate-900">
            {partido.golesLocal} - {partido.golesVisitante}
          </span>

          {esEliminatoria && partido.ganadorPenales && (
            <p className="mt-1 text-xs font-semibold text-amber-700">
              Penales:{" "}
              {partido.ganadorPenales === "LOCAL"
                ? partido.equipoLocal
                : partido.equipoVisitante}
            </p>
          )}
        </div>
      );
    }

    return (
      <div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            value={resultado.golesLocal}
            onChange={(event) =>
              actualizarResultado(partido.id, "golesLocal", event.target.value)
            }
            className="w-16 rounded-lg border border-slate-300 px-2 py-2 text-center text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            placeholder="0"
          />

          <span className="text-slate-400">-</span>

          <input
            type="number"
            min="0"
            value={resultado.golesVisitante}
            onChange={(event) =>
              actualizarResultado(partido.id, "golesVisitante", event.target.value)
            }
            className="w-16 rounded-lg border border-slate-300 px-2 py-2 text-center text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            placeholder="0"
          />
        </div>

        {esEliminatoria && resultadoTemporalEsEmpate(partido) && (
          <div className="mt-2">
            <select
              value={resultado.ganadorPenales ?? ""}
              onChange={(event) =>
                actualizarResultado(partido.id, "ganadorPenales", event.target.value)
              }
              className="w-full rounded-lg border border-amber-300 bg-amber-50 px-2 py-2 text-xs font-semibold text-amber-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            >
              <option value="">Ganador por penales</option>
              <option value="LOCAL">{partido.equipoLocal}</option>
              <option value="VISITANTE">{partido.equipoVisitante}</option>
            </select>
          </div>
        )}
      </div>
    );
  }

  function AccionFinalizar({ partido }: { partido: Partido }) {
    if (partido.estado === "finalizado") {
      return (
        <span className="text-sm font-medium text-green-700">
          Cerrado
        </span>
      );
    }

    return (
      <Button
        type="button"
        variant="dark"
        onClick={() => manejarFinalizarPartido(partido)}
        disabled={finalizandoId === partido.id}
      >
        {finalizandoId === partido.id ? "Calculando..." : "Finalizar"}
      </Button>
    );
  }

  function PartidoMobileCard({ partido }: { partido: Partido }) {
    const esEliminatoria = obtenerTipoPartido(partido) === "eliminatoria";

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <Badge variant={obtenerEstadoBadge(partido)}>
                {partido.estado}
              </Badge>

              <Badge variant={esEliminatoria ? "amber" : "blue"}>
                {esEliminatoria ? "Eliminatoria" : "Grupos"}
              </Badge>
            </div>

            <p className="mt-3 text-sm font-semibold text-slate-500">
              {formatearFecha(partido.fecha)}
            </p>

            <h3 className="mt-1 text-lg font-black leading-tight text-slate-900">
              {partido.equipoLocal} vs {partido.equipoVisitante}
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              {esEliminatoria
                ? partido.ronda ?? "Eliminatoria"
                : partido.grupo}
            </p>

            {partido.estado === "finalizado" && esEliminatoria && partido.clasificado && (
              <p className="mt-2 text-sm font-semibold text-green-700">
                Clasifica: {obtenerTextoClasificado(partido)}
              </p>
            )}
          </div>

          <div className="rounded-xl bg-slate-100 px-3 py-2 text-center">
            <p className="text-xs font-bold text-slate-500">Hora</p>
            <p className="text-sm font-black text-slate-900">
              {formatearHora(partido.fecha)}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-slate-50 p-4">
          <p className="mb-2 text-xs font-bold uppercase text-slate-500">
            Resultado
          </p>

          <ResultadoInputs partido={partido} />
        </div>

        <div className="mt-4">
          <AccionFinalizar partido={partido} />
        </div>
      </div>
    );
  }

  if (cargando) {
    return <Loader texto="Cargando sesión..." />;
  }

  if (!usuario || !perfil || perfil.rol !== "admin") {
    return null;
  }

  return (
    <PageContainer>
      <AppHeader />

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-blue-600">
          Administración
        </p>

        <h1 className="text-3xl font-bold text-slate-900">
          Administración de partidos
        </h1>

        <p className="max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
          Crea partidos y finaliza resultados. Usa los filtros para encontrar
          rápidamente los partidos pendientes.
        </p>
      </div>

      {mensajeError && (
        <div className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {mensajeError}
        </div>
      )}

      {mensajeExito && (
        <div className="mt-6 rounded-2xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
          {mensajeExito}
        </div>
      )}

      <div className="mt-8 grid gap-6 xl:grid-cols-[390px_1fr]">
        <Card>
          <h2 className="text-xl font-bold text-slate-900">Crear partido</h2>

          <form onSubmit={manejarGuardarPartido} className="mt-6 space-y-5">
            <div>
              <label
                htmlFor="tipoPartido"
                className="block text-sm font-medium text-slate-700"
              >
                Tipo de partido
              </label>

              <select
                id="tipoPartido"
                value={tipoPartido}
                onChange={(event) =>
                  setTipoPartido(event.target.value as TipoPartido)
                }
                className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <option value="grupos">Fase de grupos</option>
                <option value="eliminatoria">Eliminatoria</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="equipoLocal"
                className="block text-sm font-medium text-slate-700"
              >
                Equipo local
              </label>

              <input
                id="equipoLocal"
                type="text"
                value={equipoLocal}
                onChange={(event) => setEquipoLocal(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="Ej. Brasil"
                required
              />
            </div>

            <div>
              <label
                htmlFor="equipoVisitante"
                className="block text-sm font-medium text-slate-700"
              >
                Equipo visitante
              </label>

              <input
                id="equipoVisitante"
                type="text"
                value={equipoVisitante}
                onChange={(event) => setEquipoVisitante(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="Ej. Japón"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <div>
                <label
                  htmlFor="fecha"
                  className="block text-sm font-medium text-slate-700"
                >
                  Fecha
                </label>

                <input
                  id="fecha"
                  type="date"
                  value={fecha}
                  onChange={(event) => setFecha(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="hora"
                  className="block text-sm font-medium text-slate-700"
                >
                  Hora
                </label>

                <input
                  id="hora"
                  type="time"
                  value={hora}
                  onChange={(event) => setHora(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  required
                />
              </div>
            </div>

            {tipoPartido === "grupos" ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <div>
                  <label
                    htmlFor="fase"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Fase
                  </label>

                  <select
                    id="fase"
                    value={fase}
                    onChange={(event) => setFase(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="Grupos">Grupos</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="grupo"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Grupo
                  </label>

                  <select
                    id="grupo"
                    value={grupo}
                    onChange={(event) => setGrupo(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  >
                    {GRUPOS.map((grupoItem) => (
                      <option key={grupoItem} value={grupoItem}>
                        {grupoItem}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div>
                <label
                  htmlFor="ronda"
                  className="block text-sm font-medium text-slate-700"
                >
                  Ronda eliminatoria
                </label>

                <select
                  id="ronda"
                  value={ronda}
                  onChange={(event) => setRonda(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  {RONDAS_ELIMINATORIAS.map((rondaItem) => (
                    <option key={rondaItem} value={rondaItem}>
                      {rondaItem}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Button type="submit" disabled={guardando} className="w-full">
              {guardando ? "Guardando..." : "Guardar partido"}
            </Button>
          </form>
        </Card>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="p-4">
              <p className="text-xs font-bold uppercase text-slate-500">
                Total
              </p>
              <p className="text-3xl font-black text-slate-900">
                {resumen.total}
              </p>
            </Card>

            <Card className="p-4">
              <p className="text-xs font-bold uppercase text-slate-500">
                Pendientes
              </p>
              <p className="text-3xl font-black text-amber-600">
                {resumen.pendientes}
              </p>
            </Card>

            <Card className="p-4">
              <p className="text-xs font-bold uppercase text-slate-500">
                Finalizados
              </p>
              <p className="text-3xl font-black text-green-600">
                {resumen.finalizados}
              </p>
            </Card>

            <Card className="p-4">
              <p className="text-xs font-bold uppercase text-slate-500">
                Eliminatoria
              </p>
              <p className="text-3xl font-black text-blue-600">
                {resumen.eliminatoria}
              </p>
            </Card>
          </div>

          <Card className="p-4 sm:p-5">
            <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
              <input
                type="text"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Buscar equipo..."
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />

              <select
                value={filtroEstado}
                onChange={(event) =>
                  setFiltroEstado(event.target.value as FiltroEstado)
                }
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <option value="pendientes">Pendientes</option>
                <option value="todos">Todos</option>
                <option value="programado">Programados</option>
                <option value="en_juego">En juego</option>
                <option value="finalizado">Finalizados</option>
              </select>

              <select
                value={filtroTipo}
                onChange={(event) => setFiltroTipo(event.target.value as FiltroTipo)}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <option value="todos">Todos los tipos</option>
                <option value="grupos">Grupos</option>
                <option value="eliminatoria">Eliminatoria</option>
              </select>

              <input
                type="date"
                value={filtroFecha}
                onChange={(event) => setFiltroFecha(event.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />

              <Button type="button" variant="secondary" onClick={limpiarFiltros}>
                Limpiar
              </Button>
            </div>
          </Card>

          <Card>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Partidos registrados
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Mostrando {partidosOrdenadosFiltrados.length} de{" "}
                  {partidos.length} partidos.
                </p>
              </div>
            </div>

            {partidosOrdenadosFiltrados.length === 0 ? (
              <p className="mt-6 text-slate-600">
                No hay partidos que coincidan con los filtros seleccionados.
              </p>
            ) : (
              <>
                <div className="mt-6 space-y-4 lg:hidden">
                  {partidosOrdenadosFiltrados.map((partido) => (
                    <PartidoMobileCard key={partido.id} partido={partido} />
                  ))}
                </div>

                <div className="mt-6 hidden overflow-x-auto lg:block">
                  <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-3 pr-4 font-semibold">Fecha</th>
                        <th className="py-3 pr-4 font-semibold">Partido</th>
                        <th className="py-3 pr-4 font-semibold">Tipo</th>
                        <th className="py-3 pr-4 font-semibold">Fase/Ronda</th>
                        <th className="py-3 pr-4 font-semibold">Estado</th>
                        <th className="py-3 pr-4 font-semibold">Resultado</th>
                        <th className="py-3 pr-4 font-semibold">Acción</th>
                      </tr>
                    </thead>

                    <tbody>
                      {partidosOrdenadosFiltrados.map((partido) => {
                        const esEliminatoria =
                          obtenerTipoPartido(partido) === "eliminatoria";

                        return (
                          <tr
                            key={partido.id}
                            className="border-b border-slate-100 text-slate-700"
                          >
                            <td className="whitespace-nowrap py-3 pr-4">
                              {formatearFecha(partido.fecha)}
                            </td>

                            <td className="py-3 pr-4 font-medium text-slate-900">
                              <div>
                                <p>
                                  {partido.equipoLocal} vs{" "}
                                  {partido.equipoVisitante}
                                </p>

                                {partido.estado === "finalizado" &&
                                  esEliminatoria &&
                                  partido.clasificado && (
                                    <p className="mt-1 text-xs font-semibold text-green-700">
                                      Clasifica:{" "}
                                      {obtenerTextoClasificado(partido)}
                                    </p>
                                  )}
                              </div>
                            </td>

                            <td className="py-3 pr-4">
                              <Badge variant={esEliminatoria ? "amber" : "blue"}>
                                {esEliminatoria ? "Eliminatoria" : "Grupos"}
                              </Badge>
                            </td>

                            <td className="py-3 pr-4">
                              {esEliminatoria
                                ? partido.ronda ?? "Eliminatoria"
                                : partido.grupo}
                            </td>

                            <td className="py-3 pr-4">
                              <Badge variant={obtenerEstadoBadge(partido)}>
                                {partido.estado}
                              </Badge>
                            </td>

                            <td className="py-3 pr-4">
                              <ResultadoInputs partido={partido} />
                            </td>

                            <td className="py-3 pr-4">
                              <AccionFinalizar partido={partido} />
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
        </div>
      </div>
    </PageContainer>
  );
}