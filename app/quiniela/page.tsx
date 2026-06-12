"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import PageContainer from "@/components/ui/PageContainer";
import Card from "@/components/ui/Card";
import Loader from "@/components/ui/Loader";
import MatchCard, {
  Partido,
  PrediccionPartido,
} from "@/components/MatchCard";

type Prediccion = {
  id: string;
  userId: string;
  matchId: string;
  golesLocalPredicho: number;
  golesVisitantePredicho: number;
  puntos: number;
};

type PrediccionesPorPartido = Record<string, PrediccionPartido>;

type FiltroEstado = "todos" | "pendientes" | "guardados" | "cerrados";
type VistaRapida = "proximos" | "todos";

export default function QuinielaPage() {
  const router = useRouter();
  const { usuario, perfil, cargando } = useAuth();

  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [predicciones, setPredicciones] = useState<PrediccionesPorPartido>({});
  const [guardandoId, setGuardandoId] = useState<string | null>(null);

  const [vistaRapida, setVistaRapida] = useState<VistaRapida>("proximos");
  const [grupoSeleccionado, setGrupoSeleccionado] = useState("Todos");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("pendientes");

  const [mensajeError, setMensajeError] = useState("");
  const [mensajeExito, setMensajeExito] = useState("");

  useEffect(() => {
    if (!cargando && !usuario) {
      router.push("/login");
    }
  }, [usuario, cargando, router]);

  useEffect(() => {
    if (!usuario) {
      return;
    }

    const partidosQuery = query(
      collection(db, "matches"),
      orderBy("fecha", "asc")
    );

    const unsubscribe = onSnapshot(partidosQuery, (snapshot) => {
      const lista = snapshot.docs.map((documento) => ({
        id: documento.id,
        ...documento.data(),
      })) as Partido[];

      setPartidos(lista);
    });

    return () => unsubscribe();
  }, [usuario]);

  useEffect(() => {
    if (!usuario) {
      return;
    }

    const prediccionesQuery = query(
      collection(db, "predictions"),
      where("userId", "==", usuario.uid)
    );

    const unsubscribe = onSnapshot(prediccionesQuery, (snapshot) => {
      const prediccionesUsuario: PrediccionesPorPartido = {};

      snapshot.docs.forEach((documento) => {
        const data = documento.data() as Prediccion;

        prediccionesUsuario[data.matchId] = {
          golesLocalPredicho: String(data.golesLocalPredicho),
          golesVisitantePredicho: String(data.golesVisitantePredicho),
          guardada: true,
        };
      });

      setPredicciones((actuales) => ({
        ...actuales,
        ...prediccionesUsuario,
      }));
    });

    return () => unsubscribe();
  }, [usuario]);

  function actualizarPrediccion(
    matchId: string,
    campo: "golesLocalPredicho" | "golesVisitantePredicho",
    valor: string
  ) {
    setMensajeError("");
    setMensajeExito("");

    setPredicciones((actuales) => ({
      ...actuales,
      [matchId]: {
        golesLocalPredicho: actuales[matchId]?.golesLocalPredicho ?? "",
        golesVisitantePredicho:
          actuales[matchId]?.golesVisitantePredicho ?? "",
        guardada: false,
        [campo]: valor,
      },
    }));
  }

  async function guardarPrediccion(
    event: FormEvent<HTMLFormElement>,
    partido: Partido
  ) {
    event.preventDefault();

    if (!usuario) {
      router.push("/login");
      return;
    }

    setMensajeError("");
    setMensajeExito("");

    if (partido.estado !== "programado") {
      setMensajeError("Este partido ya no permite predicciones.");
      return;
    }

    if (partidoYaInicio(partido)) {
      setMensajeError(
        "Ya no puedes registrar o modificar esta predicción porque el partido ya inició."
      );
      return;
    }

    const prediccion = predicciones[partido.id];

    if (
      !prediccion ||
      prediccion.golesLocalPredicho === "" ||
      prediccion.golesVisitantePredicho === ""
    ) {
      setMensajeError("Debes ingresar ambos marcadores.");
      return;
    }

    const golesLocalPredicho = Number(prediccion.golesLocalPredicho);
    const golesVisitantePredicho = Number(prediccion.golesVisitantePredicho);

    if (
      Number.isNaN(golesLocalPredicho) ||
      Number.isNaN(golesVisitantePredicho) ||
      golesLocalPredicho < 0 ||
      golesVisitantePredicho < 0
    ) {
      setMensajeError(
        "Los marcadores deben ser números mayores o iguales a cero."
      );
      return;
    }

    setGuardandoId(partido.id);

    try {
      const predictionId = `${usuario.uid}_${partido.id}`;
      const predictionRef = doc(db, "predictions", predictionId);

      const datosPrediccion = {
        userId: usuario.uid,
        userName: perfil?.nombre ?? usuario.email,
        userEmail: usuario.email,
        matchId: partido.id,
        equipoLocal: partido.equipoLocal,
        equipoVisitante: partido.equipoVisitante,
        golesLocalPredicho,
        golesVisitantePredicho,
        actualizadoEn: serverTimestamp(),
      };

      await setDoc(
        predictionRef,
        prediccion.guardada
          ? datosPrediccion
          : {
              ...datosPrediccion,
              puntos: 0,
              partidoFinalizado: false,
              creadoEn: serverTimestamp(),
            },
        { merge: true }
      );

      setPredicciones((actuales) => ({
        ...actuales,
        [partido.id]: {
          golesLocalPredicho: String(golesLocalPredicho),
          golesVisitantePredicho: String(golesVisitantePredicho),
          guardada: true,
        },
      }));

      setMensajeExito("Predicción guardada correctamente.");
    } catch (error) {
      console.error(error);
      setMensajeError("No se pudo guardar la predicción.");
    } finally {
      setGuardandoId(null);
    }
  }

  function partidoYaInicio(partido: Partido) {
    const fechaPartido = partido.fecha.toDate();
    const ahora = new Date();

    return ahora >= fechaPartido;
  }

  function prediccionBloqueada(partido: Partido) {
    return partido.estado !== "programado" || partidoYaInicio(partido);
  }

  const totalPendientes = partidos.filter((partido) => {
    const prediccion = predicciones[partido.id];
    const bloqueado = prediccionBloqueada(partido);

    return !prediccion?.guardada && !bloqueado;
  }).length;

  const totalGuardados = partidos.filter((partido) => {
    const prediccion = predicciones[partido.id];
    const bloqueado = prediccionBloqueada(partido);

    return prediccion?.guardada && !bloqueado;
  }).length;

  const totalCerrados = partidos.filter((partido) =>
    prediccionBloqueada(partido)
  ).length;

  const partidosProximos = partidos
    .filter((partido) => !prediccionBloqueada(partido))
    .slice(0, 8);

  const partidosBase =
    vistaRapida === "proximos" ? partidosProximos : partidos;

  const gruposDisponibles = [
    "Todos",
    ...Array.from(new Set(partidos.map((partido) => partido.grupo))).sort(),
  ];

  const partidosFiltrados = partidosBase.filter((partido) => {
    const prediccion = predicciones[partido.id];
    const bloqueado = prediccionBloqueada(partido);

    const coincideGrupo =
      grupoSeleccionado === "Todos" || partido.grupo === grupoSeleccionado;

    const coincideEstado =
      filtroEstado === "todos" ||
      (filtroEstado === "pendientes" && !prediccion?.guardada && !bloqueado) ||
      (filtroEstado === "guardados" && prediccion?.guardada && !bloqueado) ||
      (filtroEstado === "cerrados" && bloqueado);

    return coincideGrupo && coincideEstado;
  });

  const proximoPartido = partidosProximos[0];

  function activarVistaProximos() {
    setVistaRapida("proximos");
    setGrupoSeleccionado("Todos");
    setFiltroEstado("pendientes");
  }

  function activarVistaTodos() {
    setVistaRapida("todos");
    setGrupoSeleccionado("Todos");
    setFiltroEstado("todos");
  }

  if (cargando) {
    return <Loader texto="Cargando sesión..." />;
  }

  if (!usuario) {
    return null;
  }

  return (
    <PageContainer>
      <AppHeader />

      <div className="mb-8">
        <p className="text-sm font-semibold text-blue-600">
          Quiniela Mundial
        </p>

        <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">
          Mis predicciones
        </h1>

        <p className="mt-2 max-w-2xl text-slate-600">
          Hola, {perfil?.nombre || usuario.email}. Registra tus marcadores
          antes de que los partidos inicien.
        </p>

        {proximoPartido && (
          <Card className="mt-6 border-blue-200 bg-gradient-to-r from-blue-600 to-slate-900 p-6 text-white">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-blue-100">
                  Próximo partido a jugarse
                </p>

                <h2 className="mt-2 text-3xl font-black">
                  {proximoPartido.equipoLocal} vs{" "}
                  {proximoPartido.equipoVisitante}
                </h2>

                <p className="mt-2 text-sm font-medium text-blue-100">
                  {proximoPartido.grupo} ·{" "}
                  {proximoPartido.fecha.toDate().toLocaleString("es-HN", {
                    dateStyle: "full",
                    timeStyle: "short",
                  })}
                </p>
              </div>

              <div className="rounded-2xl bg-white/15 px-5 py-4 text-center backdrop-blur">
                <p className="text-sm font-semibold text-blue-100">
                  Partidos próximos
                </p>
                <p className="mt-1 text-4xl font-black">
                  {partidosProximos.length}
                </p>
              </div>
            </div>
          </Card>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Card className="p-5">
            <p className="text-sm font-semibold text-slate-500">Pendientes</p>
            <p className="mt-1 text-3xl font-black text-blue-600">
              {totalPendientes}
            </p>
          </Card>

          <Card className="p-5">
            <p className="text-sm font-semibold text-slate-500">Guardados</p>
            <p className="mt-1 text-3xl font-black text-green-600">
              {totalGuardados}
            </p>
          </Card>

          <Card className="p-5">
            <p className="text-sm font-semibold text-slate-500">Cerrados</p>
            <p className="mt-1 text-3xl font-black text-amber-600">
              {totalCerrados}
            </p>
          </Card>
        </div>

        <div className="mt-6 rounded-2xl bg-white/80 p-4 ring-1 ring-slate-200">
          <p className="mb-3 text-sm font-bold text-slate-700">
            Vista rápida
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={activarVistaProximos}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                vistaRapida === "proximos"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              Próximos a jugarse
            </button>

            <button
              type="button"
              onClick={activarVistaTodos}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                vistaRapida === "todos"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              Todos los partidos
            </button>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <p className="mb-2 text-sm font-bold text-slate-700">
              Filtrar por grupo
            </p>

            <div className="flex gap-2 overflow-x-auto pb-2">
              {gruposDisponibles.map((grupo) => (
                <button
                  key={grupo}
                  type="button"
                  onClick={() => setGrupoSeleccionado(grupo)}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${
                    grupoSeleccionado === grupo
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {grupo}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-bold text-slate-700">
              Filtrar por estado
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFiltroEstado("todos")}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  filtroEstado === "todos"
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                Todos
              </button>

              <button
                type="button"
                onClick={() => setFiltroEstado("pendientes")}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  filtroEstado === "pendientes"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                Pendientes
              </button>

              <button
                type="button"
                onClick={() => setFiltroEstado("guardados")}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  filtroEstado === "guardados"
                    ? "bg-green-600 text-white"
                    : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                Guardados
              </button>

              <button
                type="button"
                onClick={() => setFiltroEstado("cerrados")}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  filtroEstado === "cerrados"
                    ? "bg-amber-600 text-white"
                    : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                Cerrados
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-white/80 px-5 py-4 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
          {vistaRapida === "proximos"
            ? `Mostrando ${partidosFiltrados.length} partidos próximos disponibles`
            : `Mostrando ${partidosFiltrados.length} de ${partidos.length} partidos`}
        </div>
      </div>

      {(mensajeError || mensajeExito) && (
        <div className="mb-6">
          {mensajeError && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {mensajeError}
            </div>
          )}

          {mensajeExito && (
            <div className="mt-3 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
              {mensajeExito}
            </div>
          )}
        </div>
      )}

      {partidos.length === 0 ? (
        <Card>
          <h2 className="text-xl font-bold text-slate-900">
            No hay partidos disponibles
          </h2>

          <p className="mt-2 text-slate-600">
            El administrador todavía no ha registrado partidos.
          </p>
        </Card>
      ) : partidosFiltrados.length === 0 ? (
        <Card>
          <h2 className="text-xl font-bold text-slate-900">
            No hay partidos para este filtro
          </h2>

          <p className="mt-2 text-slate-600">
            Prueba seleccionando otra vista, otro grupo o cambiando el filtro de
            estado.
          </p>
        </Card>
      ) : (
        <div className="grid gap-5">
          {partidosFiltrados.map((partido) => {
            const prediccion = predicciones[partido.id];
            const yaInicio = partidoYaInicio(partido);
            const bloqueado = prediccionBloqueada(partido);

            return (
              <MatchCard
                key={partido.id}
                partido={partido}
                prediccion={prediccion}
                bloqueado={bloqueado}
                yaInicio={yaInicio}
                guardando={guardandoId === partido.id}
                onCambiarPrediccion={actualizarPrediccion}
                onGuardarPrediccion={guardarPrediccion}
              />
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}