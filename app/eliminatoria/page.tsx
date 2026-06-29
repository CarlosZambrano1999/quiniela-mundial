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

  const resumen = useMemo(() => {
    const total = partidos.length;
    const guardadas = partidos.filter(
      (partido) => predicciones[partido.id]?.guardada
    ).length;
    const pendientes = total - guardadas;
    const finalizados = partidos.filter(
      (partido) => partido.estado === "finalizado"
    ).length;

    return {
      total,
      guardadas,
      pendientes,
      finalizados,
    };
  }, [partidos, predicciones]);

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

      {partidos.length === 0 ? (
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
          {partidos.map((partido) => (
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