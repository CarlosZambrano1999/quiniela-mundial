"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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
import Badge from "@/components/ui/Badge";
import Loader from "@/components/ui/Loader";
import KnockoutMatchCard, {
  EquipoGanador,
  PartidoEliminatoria,
  PrediccionEliminatoria,
} from "@/components/KnockoutMatchCard";

type PrediccionesPorPartido = Record<string, PrediccionEliminatoria>;

export default function EliminatoriaPage() {
  const router = useRouter();
  const { usuario, perfil, cargando } = useAuth();

  const [partidos, setPartidos] = useState<PartidoEliminatoria[]>([]);
  const [predicciones, setPredicciones] = useState<PrediccionesPorPartido>({});
  const [cargandoPartidos, setCargandoPartidos] = useState(true);
  const [cargandoPredicciones, setCargandoPredicciones] = useState(true);
  const [guardandoId, setGuardandoId] = useState<string | null>(null);
  const [mensajeError, setMensajeError] = useState("");
  const [mensajeExito, setMensajeExito] = useState("");
  const [fechaSeleccionada, setFechaSeleccionada] = useState(obtenerFechaActualClave());

  useEffect(() => {
    if (cargando) {
      return;
    }

    if (!usuario) {
      router.push("/login");
    }
  }, [usuario, cargando, router]);

  useEffect(() => {
    const partidosQuery = query(
      collection(db, "matches"),
      orderBy("fecha", "asc")
    );

    const unsubscribe = onSnapshot(
      partidosQuery,
      (snapshot) => {
        const lista = snapshot.docs
          .map((documento) => ({
            id: documento.id,
            ...documento.data(),
          }))
          .filter(
            (partido) =>
              (partido as PartidoEliminatoria).tipoPartido === "eliminatoria"
          ) as PartidoEliminatoria[];

        setPartidos(lista);
        setCargandoPartidos(false);
      },
      (error) => {
        console.error(error);
        setMensajeError("No se pudieron cargar los partidos de eliminatoria.");
        setCargandoPartidos(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!usuario) {
      setPredicciones({});
      setCargandoPredicciones(false);
      return;
    }

    const prediccionesQuery = query(
      collection(db, "predictions"),
      where("userId", "==", usuario.uid)
    );

    const unsubscribe = onSnapshot(
      prediccionesQuery,
      (snapshot) => {
        const mapa: PrediccionesPorPartido = {};

        snapshot.docs.forEach((documento) => {
          const data = documento.data();

          if (data.tipoPartido !== "eliminatoria") {
            return;
          }

          mapa[data.matchId] = {
            golesLocalPredicho:
              data.golesLocalPredicho !== undefined
                ? String(data.golesLocalPredicho)
                : "",
            golesVisitantePredicho:
              data.golesVisitantePredicho !== undefined
                ? String(data.golesVisitantePredicho)
                : "",
            ganadorPenalesPredicho:
              data.ganadorPenalesPredicho ?? null,
            guardada: true,
          };
        });

        setPredicciones(mapa);
        setCargandoPredicciones(false);
      },
      (error) => {
        console.error(error);
        setMensajeError("No se pudieron cargar tus predicciones.");
        setCargandoPredicciones(false);
      }
    );

    return () => unsubscribe();
  }, [usuario]);

  function obtenerFechaActualClave() {
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, "0");
    const dia = String(hoy.getDate()).padStart(2, "0");

    return `${anio}-${mes}-${dia}`;
    }
  

  function partidoYaInicio(partido: PartidoEliminatoria) {
    const fechaPartido = partido.fecha.toDate();
    const ahora = new Date();

    return ahora >= fechaPartido;
  }

  function prediccionBloqueada(partido: PartidoEliminatoria) {
    return partido.estado !== "programado" || partidoYaInicio(partido);
  }

  function cambiarPrediccion(
    matchId: string,
    campo:
      | "golesLocalPredicho"
      | "golesVisitantePredicho"
      | "ganadorPenalesPredicho",
    valor: string
  ) {
    setMensajeError("");
    setMensajeExito("");

    setPredicciones((prev) => {
      const prediccionActual = prev[matchId] ?? {
        golesLocalPredicho: "",
        golesVisitantePredicho: "",
        ganadorPenalesPredicho: null,
        guardada: false,
      };

      if (campo === "ganadorPenalesPredicho") {
        return {
          ...prev,
          [matchId]: {
            ...prediccionActual,
            ganadorPenalesPredicho: valor as EquipoGanador,
          },
        };
      }

      return {
        ...prev,
        [matchId]: {
          ...prediccionActual,
          [campo]: valor,
        },
      };
    });
  }

  function obtenerClasificadoPredicho(
    golesLocalPredicho: number,
    golesVisitantePredicho: number,
    ganadorPenalesPredicho: EquipoGanador
  ): EquipoGanador {
    if (golesLocalPredicho > golesVisitantePredicho) {
      return "LOCAL";
    }

    if (golesVisitantePredicho > golesLocalPredicho) {
      return "VISITANTE";
    }

    return ganadorPenalesPredicho;
  }

  async function guardarPrediccion(
    event: FormEvent<HTMLFormElement>,
    partido: PartidoEliminatoria
  ) {
    event.preventDefault();

    if (!usuario) {
      setMensajeError("Debes iniciar sesión para guardar tu predicción.");
      return;
    }

    if (prediccionBloqueada(partido)) {
      setMensajeError("Este partido ya no permite modificar predicciones.");
      return;
    }

    const prediccion = predicciones[partido.id];

    if (!prediccion) {
      setMensajeError("Ingresa una predicción antes de guardar.");
      return;
    }

    if (
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
      setMensajeError("Los marcadores deben ser números válidos.");
      return;
    }

    const prediccionEsEmpate = golesLocalPredicho === golesVisitantePredicho;

    if (prediccionEsEmpate && !prediccion.ganadorPenalesPredicho) {
      setMensajeError(
        "Predijiste empate. Debes seleccionar quién gana por penales."
      );
      return;
    }

    const ganadorPenalesPredicho = prediccionEsEmpate
      ? prediccion.ganadorPenalesPredicho
      : null;

    const clasificadoPredicho = obtenerClasificadoPredicho(
      golesLocalPredicho,
      golesVisitantePredicho,
      ganadorPenalesPredicho
    );

    if (!clasificadoPredicho) {
      setMensajeError("Debes seleccionar el clasificado.");
      return;
    }

    setGuardandoId(partido.id);
    setMensajeError("");
    setMensajeExito("");

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

        tipoPartido: "eliminatoria",
        fase: partido.fase,
        ronda: partido.ronda ?? partido.fase,

        golesLocalPredicho,
        golesVisitantePredicho,
        ganadorPenalesPredicho,
        clasificadoPredicho,

        actualizadoEn: serverTimestamp(),
      };

      await setDoc(
        predictionRef,
        prediccion.guardada
          ? datosPrediccion
          : {
              ...datosPrediccion,
              puntos: 0,
              puntosExacto: 0,
              puntosGanador: 0,
              puntosDiferencia: 0,
              puntosPenales: 0,
              puntosEliminatoria: 0,
              partidoFinalizado: false,
              creadoEn: serverTimestamp(),
            },
        { merge: true }
      );

      setPredicciones((prev) => ({
        ...prev,
        [partido.id]: {
          golesLocalPredicho: String(golesLocalPredicho),
          golesVisitantePredicho: String(golesVisitantePredicho),
          ganadorPenalesPredicho,
          guardada: true,
        },
      }));

      setMensajeExito("Predicción de eliminatoria guardada correctamente.");
    } catch (error) {
      console.error(error);
      setMensajeError("No se pudo guardar la predicción.");
    } finally {
      setGuardandoId(null);
    }
  }

  function obtenerFechaClave(fecha: Date) {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const dia = String(fecha.getDate()).padStart(2, "0");

    return `${anio}-${mes}-${dia}`;
    }

    function formatearFechaVisible(fechaClave: string) {
    const [anio, mes, dia] = fechaClave.split("-").map(Number);
    const fecha = new Date(anio, mes - 1, dia);

    return fecha.toLocaleDateString("es-HN", {
        weekday: "long",
        day: "2-digit",
        month: "long",
    });
    }

    const fechasDisponibles = useMemo(() => {
  const fechas = partidos.map((partido) =>
    obtenerFechaClave(partido.fecha.toDate())
  );

  return Array.from(new Set(fechas)).sort();
}, [partidos]);

const partidosFiltrados = useMemo(() => {
  if (fechaSeleccionada === "TODAS") {
    return partidos;
  }

  return partidos.filter(
    (partido) => obtenerFechaClave(partido.fecha.toDate()) === fechaSeleccionada
  );
}, [partidos, fechaSeleccionada]);

const resumen = useMemo(() => {
  const total = partidosFiltrados.length;

  const guardadas = partidosFiltrados.filter(
    (partido) => predicciones[partido.id]?.guardada
  ).length;

  const pendientes = total - guardadas;

  const finalizados = partidosFiltrados.filter(
    (partido) => partido.estado === "finalizado"
  ).length;

  return {
    total,
    guardadas,
    pendientes,
    finalizados,
  };
}, [partidosFiltrados, predicciones]);


  if (cargando || cargandoPartidos || cargandoPredicciones) {
    return <Loader texto="Cargando eliminatoria..." />;
  }

  return (
    <PageContainer>
      <AppHeader />

      <div className="mb-8">
        <p className="text-sm font-semibold text-blue-600">
          Quiniela Mundial
        </p>

        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
          Ronda eliminatoria
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
          Predice los marcadores de eliminación directa. Si colocas empate,
          debes seleccionar quién clasifica por penales.
        </p>
      </div>

      {mensajeError && (
        <div className="mb-6 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {mensajeError}
        </div>
      )}

      {mensajeExito && (
        <div className="mb-6 rounded-2xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
          {mensajeExito}
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-bold uppercase text-slate-500">
            Partidos
          </p>
          <p className="mt-1 text-3xl font-black text-slate-900">
            {resumen.total}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs font-bold uppercase text-slate-500">
            Guardadas
          </p>
          <p className="mt-1 text-3xl font-black text-blue-600">
            {resumen.guardadas}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs font-bold uppercase text-slate-500">
            Pendientes
          </p>
          <p className="mt-1 text-3xl font-black text-amber-600">
            {resumen.pendientes}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs font-bold uppercase text-slate-500">
            Finalizados
          </p>
          <p className="mt-1 text-3xl font-black text-green-600">
            {resumen.finalizados}
          </p>
        </Card>
      </div>

      <Card className="mb-6 border-blue-200 bg-blue-50 p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          <Badge variant="blue">Reglas eliminatoria</Badge>
          <Badge>Exacto: 3 pts</Badge>
          <Badge>Ganador: 1 pt</Badge>
          <Badge>Diferencia: 2 pts</Badge>
          <Badge>Penales: 1 pt</Badge>
        </div>

        <p className="mt-3 text-sm leading-6 text-slate-700">
          El ranking de eliminatoria se calculará por separado. El marcador
          exacto puede acumular también puntos por ganador y diferencia.
        </p>
      </Card>

      <Card className="mb-6 p-4 sm:p-5">
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h2 className="text-lg font-black text-slate-900">
        Filtrar partidos
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Selecciona una fecha para ver solo los partidos de ese día.
      </p>
    </div>

    <div className="w-full sm:w-72">
      <label
        htmlFor="fechaPartidos"
        className="mb-1 block text-xs font-bold uppercase text-slate-500"
      >
        Fecha
      </label>

      <select
        id="fechaPartidos"
        value={fechaSeleccionada}
        onChange={(event) => setFechaSeleccionada(event.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
      >
        <option value="TODAS">Todas las fechas</option>

        {fechasDisponibles.map((fecha) => (
          <option key={fecha} value={fecha}>
            {formatearFechaVisible(fecha)}
          </option>
        ))}
      </select>
    </div>
  </div>
</Card>

      {partidosFiltrados.length === 0 ? (
        <Card>
          <h2 className="text-xl font-black text-slate-900">
            No hay partidos de eliminatoria cargados
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Para que aparezcan aquí, los partidos deben tener el campo{" "}
            <span className="font-black">tipoPartido: "eliminatoria"</span> en
            Firestore.
          </p>
        </Card>
      ) : (
        <div className="grid gap-5">
          {partidosFiltrados.map((partido) => (
            <KnockoutMatchCard
              key={partido.id}
              partido={partido}
              prediccion={predicciones[partido.id]}
              bloqueado={prediccionBloqueada(partido)}
              yaInicio={partidoYaInicio(partido)}
              guardando={guardandoId === partido.id}
              onCambiarPrediccion={cambiarPrediccion}
              onGuardarPrediccion={guardarPrediccion}
            />
          ))}
        </div>
      )}
    </PageContainer>
  );
}