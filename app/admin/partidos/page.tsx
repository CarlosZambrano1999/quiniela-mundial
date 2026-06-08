"use client";

import { FormEvent, useEffect, useState } from "react";
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
    updateDoc,
    where,
    writeBatch
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/context/AuthContext";
import BotonCerrarSesion from "@/components/BotonCerrarSesion";
import Loader from "@/components/ui/Loader";
import PageContainer from "@/components/ui/PageContainer";
import AppHeader from "@/components/AppHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";

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

export default function AdminPartidosPage() {
    const router = useRouter();
    const { usuario, perfil, cargando } = useAuth();

    const [equipoLocal, setEquipoLocal] = useState("");
    const [equipoVisitante, setEquipoVisitante] = useState("");
    const [fecha, setFecha] = useState("");
    const [hora, setHora] = useState("");
    const [fase, setFase] = useState("Grupos");
    const [grupo, setGrupo] = useState("Grupo A");

    const [partidos, setPartidos] = useState<Partido[]>([]);
    const [guardando, setGuardando] = useState(false);
    const [mensajeError, setMensajeError] = useState("");
    const [mensajeExito, setMensajeExito] = useState("");
    const [resultados, setResultados] = useState<
        Record<
            string,
            {
                golesLocal: string;
                golesVisitante: string;
            }
        >
    >({});

    const [finalizandoId, setFinalizandoId] = useState<string | null>(null);

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

        const partidosQuery = query(collection(db, "matches"), orderBy("fecha", "asc"));

        const unsubscribe = onSnapshot(partidosQuery, (snapshot) => {
            const lista = snapshot.docs.map((documento) => ({
                id: documento.id,
                ...documento.data(),
            })) as Partido[];

            setPartidos(lista);
        });

        return () => unsubscribe();
    }, [usuario, perfil]);

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
                fase,
                grupo,
                estado: "programado",
                golesLocal: null,
                golesVisitante: null,
                creadoEn: serverTimestamp(),
            });

            setEquipoLocal("");
            setEquipoVisitante("");
            setFecha("");
            setHora("");
            setFase("Grupos");
            setGrupo("Grupo A");
            setMensajeExito("Partido creado correctamente.");
        } catch (error) {
            console.error(error);
            setMensajeError("No se pudo guardar el partido.");
        } finally {
            setGuardando(false);
        }
    }

    function formatearFecha(fechaPartido: Timestamp) {
        return fechaPartido.toDate().toLocaleString("es-HN", {
            dateStyle: "medium",
            timeStyle: "short",
        });
    }

    function actualizarResultado(
        matchId: string,
        campo: "golesLocal" | "golesVisitante",
        valor: string
    ) {
        setMensajeError("");
        setMensajeExito("");

        setResultados((actuales) => ({
            ...actuales,
            [matchId]: {
                golesLocal: actuales[matchId]?.golesLocal ?? "",
                golesVisitante: actuales[matchId]?.golesVisitante ?? "",
                [campo]: valor,
            },
        }));
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

    function calcularPuntos(params: {
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

    async function finalizarPartido(partido: Partido) {
  setMensajeError("");
  setMensajeExito("");

  const resultado = resultados[partido.id];

  if (
    !resultado ||
    resultado.golesLocal === "" ||
    resultado.golesVisitante === ""
  ) {
    setMensajeError("Debes ingresar el resultado real del partido.");
    return;
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

    const puntosNuevosPorUsuario = new Map<string, number>();

    prediccionesSnapshot.docs.forEach((documentoPrediccion) => {
      const prediccion = documentoPrediccion.data() as {
        userId: string;
        golesLocalPredicho: number;
        golesVisitantePredicho: number;
      };

      const puntos = calcularPuntos({
        golesLocalReal,
        golesVisitanteReal,
        golesLocalPredicho: prediccion.golesLocalPredicho,
        golesVisitantePredicho: prediccion.golesVisitantePredicho,
      });

      batch.update(documentoPrediccion.ref, {
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

      prediccionesFinalizadasUsuarioSnapshot.docs.forEach(
        (documentoPrediccion) => {
          const prediccion = documentoPrediccion.data() as {
            matchId: string;
            puntos?: number;
          };

          if (prediccion.matchId === partido.id) {
            puntosTotales += puntosNuevosPorUsuario.get(userId) ?? 0;
          } else {
            puntosTotales += prediccion.puntos ?? 0;
          }
        }
      );

      /**
       * Si este es el primer partido finalizado del usuario,
       * puede que la consulta anterior todavía no incluya la predicción actual
       * porque partidoFinalizado todavía no fue confirmado en Firestore.
       */
      const yaIncluyoPartidoActual =
        prediccionesFinalizadasUsuarioSnapshot.docs.some((documentoPrediccion) => {
          const prediccion = documentoPrediccion.data() as { matchId: string };
          return prediccion.matchId === partido.id;
        });

      if (!yaIncluyoPartidoActual) {
        puntosTotales += puntosNuevosPorUsuario.get(userId) ?? 0;
      }

      const userRef = doc(db, "users", userId);

      batch.update(userRef, {
        puntosTotales,
      });
    }

    const partidoRef = doc(db, "matches", partido.id);

    batch.update(partidoRef, {
      golesLocal: golesLocalReal,
      golesVisitante: golesVisitanteReal,
      estado: "finalizado",
      finalizadoEn: serverTimestamp(),
    });

    await batch.commit();

    setMensajeExito(
      `Partido finalizado. Predicciones calculadas: ${prediccionesSnapshot.size}.`
    );
  } catch (error) {
    console.error(error);
    setMensajeError("No se pudo finalizar el partido.");
  } finally {
    setFinalizandoId(null);
  }
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
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-sm font-semibold text-blue-600">
                            Administración
                        </p>

                        <h1 className="mt-2 text-3xl font-bold text-slate-900">
                            Administración de partidos
                        </h1>

                        <p className="mt-2 text-slate-600">
                            Crea los partidos del Mundial que estarán disponibles en la
                            quiniela.
                        </p>
                    </div>

                </div>

                <div className="mt-8 grid gap-6 lg:grid-cols-[420px_1fr]">
                    <Card>
                        <h2 className="text-xl font-bold text-slate-900">
                            Crear partido
                        </h2>

                        <form onSubmit={manejarGuardarPartido} className="mt-6 space-y-5">
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
                                    placeholder="Ej. Honduras"
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
                                    placeholder="Ej. España"
                                    required
                                />
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
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

                            <div className="grid gap-4 sm:grid-cols-2">
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
                                        <option value="Dieciseisavos">Dieciseisavos</option>
                                        <option value="Octavos">Octavos</option>
                                        <option value="Cuartos">Cuartos</option>
                                        <option value="Semifinal">Semifinal</option>
                                        <option value="Tercer lugar">Tercer lugar</option>
                                        <option value="Final">Final</option>
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
                                        <option value="Grupo A">Grupo A</option>
                                        <option value="Grupo B">Grupo B</option>
                                        <option value="Grupo C">Grupo C</option>
                                        <option value="Grupo D">Grupo D</option>
                                        <option value="Grupo E">Grupo E</option>
                                        <option value="Grupo F">Grupo F</option>
                                        <option value="Grupo G">Grupo G</option>
                                        <option value="Grupo H">Grupo H</option>
                                        <option value="Grupo I">Grupo I</option>
                                        <option value="Grupo J">Grupo J</option>
                                        <option value="Grupo K">Grupo K</option>
                                        <option value="Grupo L">Grupo L</option>
                                        <option value="No aplica">No aplica</option>
                                    </select>
                                </div>
                            </div>

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

                            <Button type="submit" disabled={guardando} className="w-full">
                            {guardando ? "Guardando..." : "Guardar partido"}
                            </Button>
                        </form>
                    </Card>

                    <Card>
                        <div className="flex items-center justify-between gap-4">
                            <h2 className="text-xl font-bold text-slate-900">
                                Partidos registrados
                            </h2>

                            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
                                {partidos.length} partidos
                            </span>
                        </div>

                        {partidos.length === 0 ? (
                            <p className="mt-6 text-slate-600">
                                Todavía no hay partidos registrados.
                            </p>
                        ) : (
                            <div className="mt-6 overflow-x-auto">
                                <table className="w-full border-collapse text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-200 text-slate-500">
                                            <th className="py-3 pr-4 font-semibold">Fecha</th>
                                            <th className="py-3 pr-4 font-semibold">Partido</th>
                                            <th className="py-3 pr-4 font-semibold">Fase</th>
                                            <th className="py-3 pr-4 font-semibold">Grupo</th>
                                            <th className="py-3 pr-4 font-semibold">Estado</th>
                                            <th className="py-3 pr-4 font-semibold">Resultado</th>
                                            <th className="py-3 pr-4 font-semibold">Acción</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {partidos.map((partido) => (
                                            <tr
                                                key={partido.id}
                                                className="border-b border-slate-100 text-slate-700"
                                            >
                                                <td className="py-3 pr-4 whitespace-nowrap">
                                                    {formatearFecha(partido.fecha)}
                                                </td>

                                                <td className="py-3 pr-4 font-medium text-slate-900">
                                                    {partido.equipoLocal} vs {partido.equipoVisitante}
                                                </td>

                                                <td className="py-3 pr-4">{partido.fase}</td>

                                                <td className="py-3 pr-4">{partido.grupo}</td>

                                                <td className="py-3 pr-4">
                                                    <Badge variant={partido.estado === "finalizado" ? "green" : "blue"}>
                                                        {partido.estado}
                                                        </Badge>
                                                </td>
                                                <td className="py-3 pr-4">
                                                    {partido.estado === "finalizado" ? (
                                                        <span className="font-semibold text-slate-900">
                                                            {partido.golesLocal} - {partido.golesVisitante}
                                                        </span>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={resultados[partido.id]?.golesLocal ?? ""}
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
                                                                value={resultados[partido.id]?.golesVisitante ?? ""}
                                                                onChange={(event) =>
                                                                    actualizarResultado(partido.id, "golesVisitante", event.target.value)
                                                                }
                                                                className="w-16 rounded-lg border border-slate-300 px-2 py-2 text-center text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                                                placeholder="0"
                                                            />
                                                        </div>
                                                    )}
                                                </td>

                                                <td className="py-3 pr-4">
                                                    {partido.estado === "finalizado" ? (
                                                        <span className="text-sm font-medium text-green-700">Cerrado</span>
                                                    ) : (
                                                        <Button
                                                        type="button"
                                                        variant="dark"
                                                        onClick={() => finalizarPartido(partido)}
                                                        disabled={finalizandoId === partido.id}
                                                        >
                                                        {finalizandoId === partido.id ? "Calculando..." : "Finalizar"}
                                                        </Button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>
                </div>
             </PageContainer>
    );
}