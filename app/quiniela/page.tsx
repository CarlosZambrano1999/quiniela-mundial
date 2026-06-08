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
  Timestamp,
  where,
} from "firebase/firestore";
import MatchCard, {
  Partido,
  PrediccionPartido,
} from "@/components/MatchCard";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/context/AuthContext";
import BotonCerrarSesion from "@/components/BotonCerrarSesion";
import Loader from "@/components/ui/Loader";
import PageContainer from "@/components/ui/PageContainer";
import AppHeader from "@/components/AppHeader";
import Card from "@/components/ui/Card";



type Prediccion = {
  id: string;
  userId: string;
  matchId: string;
  golesLocalPredicho: number;
  golesVisitantePredicho: number;
  puntos: number;
};

type PrediccionesPorPartido = Record<string, PrediccionPartido>;

export default function QuinielaPage() {
  const router = useRouter();
  const { usuario, perfil, cargando } = useAuth();

  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [predicciones, setPredicciones] = useState<PrediccionesPorPartido>({});
  const [guardandoId, setGuardandoId] = useState<string | null>(null);
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
      setMensajeError("Los marcadores deben ser números mayores o iguales a cero.");
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

  function formatearFecha(fechaPartido: Timestamp) {
    return fechaPartido.toDate().toLocaleString("es-HN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function partidoYaInicio(partido: Partido) {
  const fechaPartido = partido.fecha.toDate();
  const ahora = new Date();

  return ahora >= fechaPartido;
}

function prediccionBloqueada(partido: Partido) {
  return partido.estado !== "programado" || partidoYaInicio(partido);
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
        Hola, {perfil?.nombre || usuario.email}. Registra tus marcadores antes
        de que los partidos inicien.
      </p>
    </div>

    {(mensajeError || mensajeExito) && (
      <div className="mb-6">
        {mensajeError && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {mensajeError}
          </div>
        )}

        {mensajeExito && (
          <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
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
    ) : (
      <div className="grid gap-5">
        {partidos.map((partido) => {
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