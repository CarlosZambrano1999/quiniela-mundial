"use client";

import { useEffect, useState } from "react";
import {
    Timestamp,
    collection,
    doc,
    serverTimestamp,
    writeBatch,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import PageContainer from "@/components/ui/PageContainer";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";

type SlotEquipo = "LOCAL" | "VISITANTE";

type PartidoEliminatoriaSeed = {
    id: string;
    equipoLocal: string;
    equipoVisitante: string;
    fecha: string;
    fase: string;
    ronda: string;
    sede: string;

    siguientePartidoId?: string;
    siguienteSlot?: SlotEquipo;

    perdedorSiguientePartidoId?: string;
    perdedorSiguienteSlot?: SlotEquipo;
};

const partidosEliminatoria: PartidoEliminatoriaSeed[] = [
    // DIECISEISAVOS
    {
        id: "eliminatoria_001",
        equipoLocal: "Brasil",
        equipoVisitante: "Japón",
        fecha: "2026-07-01T13:00:00-06:00",
        fase: "Eliminatoria",
        ronda: "Dieciseisavos",
        sede: "Estadio de prueba 1",
        siguientePartidoId: "eliminatoria_017",
        siguienteSlot: "LOCAL",
    },
    {
        id: "eliminatoria_002",
        equipoLocal: "Alemania",
        equipoVisitante: "Paraguay",
        fecha: "2026-07-01T16:30:00-06:00",
        fase: "Eliminatoria",
        ronda: "Dieciseisavos",
        sede: "Estadio de prueba 2",
        siguientePartidoId: "eliminatoria_017",
        siguienteSlot: "VISITANTE",
    },
    {
        id: "eliminatoria_003",
        equipoLocal: "Países Bajos",
        equipoVisitante: "Marruecos",
        fecha: "2026-07-01T20:00:00-06:00",
        fase: "Eliminatoria",
        ronda: "Dieciseisavos",
        sede: "Estadio de prueba 3",
        siguientePartidoId: "eliminatoria_018",
        siguienteSlot: "LOCAL",
    },
    {
        id: "eliminatoria_004",
        equipoLocal: "Francia",
        equipoVisitante: "Suecia",
        fecha: "2026-07-02T15:00:00-06:00",
        fase: "Eliminatoria",
        ronda: "Dieciseisavos",
        sede: "Estadio de prueba 4",
        siguientePartidoId: "eliminatoria_018",
        siguienteSlot: "VISITANTE",
    },
    {
        id: "eliminatoria_005",
        equipoLocal: "España",
        equipoVisitante: "Austria",
        fecha: "2026-07-02T19:00:00-06:00",
        fase: "Eliminatoria",
        ronda: "Dieciseisavos",
        sede: "Estadio de prueba 5",
        siguientePartidoId: "eliminatoria_019",
        siguienteSlot: "LOCAL",
    },
    {
        id: "eliminatoria_006",
        equipoLocal: "Argentina",
        equipoVisitante: "Cabo Verde",
        fecha: "2026-07-03T17:00:00-06:00",
        fase: "Eliminatoria",
        ronda: "Dieciseisavos",
        sede: "Estadio de prueba 6",
        siguientePartidoId: "eliminatoria_019",
        siguienteSlot: "VISITANTE",
    },
    {
        id: "eliminatoria_007",
        equipoLocal: "Portugal",
        equipoVisitante: "Croacia",
        fecha: "2026-07-03T20:30:00-06:00",
        fase: "Eliminatoria",
        ronda: "Dieciseisavos",
        sede: "Estadio de prueba 7",
        siguientePartidoId: "eliminatoria_020",
        siguienteSlot: "LOCAL",
    },
    {
        id: "eliminatoria_008",
        equipoLocal: "Inglaterra",
        equipoVisitante: "Ghana",
        fecha: "2026-07-04T13:00:00-06:00",
        fase: "Eliminatoria",
        ronda: "Dieciseisavos",
        sede: "Estadio de prueba 8",
        siguientePartidoId: "eliminatoria_020",
        siguienteSlot: "VISITANTE",
    },
    {
        id: "eliminatoria_009",
        equipoLocal: "México",
        equipoVisitante: "Ecuador",
        fecha: "2026-07-04T16:00:00-06:00",
        fase: "Eliminatoria",
        ronda: "Dieciseisavos",
        sede: "Estadio de prueba 9",
        siguientePartidoId: "eliminatoria_021",
        siguienteSlot: "LOCAL",
    },
    {
        id: "eliminatoria_010",
        equipoLocal: "Bélgica",
        equipoVisitante: "Senegal",
        fecha: "2026-07-04T19:00:00-06:00",
        fase: "Eliminatoria",
        ronda: "Dieciseisavos",
        sede: "Estadio de prueba 10",
        siguientePartidoId: "eliminatoria_021",
        siguienteSlot: "VISITANTE",
    },
    {
        id: "eliminatoria_011",
        equipoLocal: "Estados Unidos",
        equipoVisitante: "Bosnia y Herzegovina",
        fecha: "2026-07-05T13:00:00-06:00",
        fase: "Eliminatoria",
        ronda: "Dieciseisavos",
        sede: "Estadio de prueba 11",
        siguientePartidoId: "eliminatoria_022",
        siguienteSlot: "LOCAL",
    },
    {
        id: "eliminatoria_012",
        equipoLocal: "Canadá",
        equipoVisitante: "Sudáfrica",
        fecha: "2026-07-05T16:00:00-06:00",
        fase: "Eliminatoria",
        ronda: "Dieciseisavos",
        sede: "Estadio de prueba 12",
        siguientePartidoId: "eliminatoria_022",
        siguienteSlot: "VISITANTE",
    },
    {
        id: "eliminatoria_013",
        equipoLocal: "Suiza",
        equipoVisitante: "Argelia",
        fecha: "2026-07-05T19:00:00-06:00",
        fase: "Eliminatoria",
        ronda: "Dieciseisavos",
        sede: "Estadio de prueba 13",
        siguientePartidoId: "eliminatoria_023",
        siguienteSlot: "LOCAL",
    },
    {
        id: "eliminatoria_014",
        equipoLocal: "Colombia",
        equipoVisitante: "Ghana",
        fecha: "2026-07-06T13:00:00-06:00",
        fase: "Eliminatoria",
        ronda: "Dieciseisavos",
        sede: "Estadio de prueba 14",
        siguientePartidoId: "eliminatoria_023",
        siguienteSlot: "VISITANTE",
    },
    {
        id: "eliminatoria_015",
        equipoLocal: "Australia",
        equipoVisitante: "Egipto",
        fecha: "2026-07-06T16:00:00-06:00",
        fase: "Eliminatoria",
        ronda: "Dieciseisavos",
        sede: "Estadio de prueba 15",
        siguientePartidoId: "eliminatoria_024",
        siguienteSlot: "LOCAL",
    },
    {
        id: "eliminatoria_016",
        equipoLocal: "Noruega",
        equipoVisitante: "Costa de Marfil",
        fecha: "2026-07-06T19:00:00-06:00",
        fase: "Eliminatoria",
        ronda: "Dieciseisavos",
        sede: "Estadio de prueba 16",
        siguientePartidoId: "eliminatoria_024",
        siguienteSlot: "VISITANTE",
    },

    // OCTAVOS
    {
        id: "eliminatoria_017",
        equipoLocal: "Por definir",
        equipoVisitante: "Por definir",
        fecha: "2026-07-08T13:00:00-06:00",
        fase: "Eliminatoria",
        ronda: "Octavos",
        sede: "Estadio de prueba 17",
        siguientePartidoId: "eliminatoria_025",
        siguienteSlot: "LOCAL",
    },
    {
        id: "eliminatoria_018",
        equipoLocal: "Por definir",
        equipoVisitante: "Por definir",
        fecha: "2026-07-08T17:00:00-06:00",
        fase: "Eliminatoria",
        ronda: "Octavos",
        sede: "Estadio de prueba 18",
        siguientePartidoId: "eliminatoria_025",
        siguienteSlot: "VISITANTE",
    },
    {
        id: "eliminatoria_019",
        equipoLocal: "Por definir",
        equipoVisitante: "Por definir",
        fecha: "2026-07-09T13:00:00-06:00",
        fase: "Eliminatoria",
        ronda: "Octavos",
        sede: "Estadio de prueba 19",
        siguientePartidoId: "eliminatoria_026",
        siguienteSlot: "LOCAL",
    },
    {
        id: "eliminatoria_020",
        equipoLocal: "Por definir",
        equipoVisitante: "Por definir",
        fecha: "2026-07-09T17:00:00-06:00",
        fase: "Eliminatoria",
        ronda: "Octavos",
        sede: "Estadio de prueba 20",
        siguientePartidoId: "eliminatoria_026",
        siguienteSlot: "VISITANTE",
    },
    {
        id: "eliminatoria_021",
        equipoLocal: "Por definir",
        equipoVisitante: "Por definir",
        fecha: "2026-07-10T13:00:00-06:00",
        fase: "Eliminatoria",
        ronda: "Octavos",
        sede: "Estadio de prueba 21",
        siguientePartidoId: "eliminatoria_027",
        siguienteSlot: "LOCAL",
    },
    {
        id: "eliminatoria_022",
        equipoLocal: "Por definir",
        equipoVisitante: "Por definir",
        fecha: "2026-07-10T17:00:00-06:00",
        fase: "Eliminatoria",
        ronda: "Octavos",
        sede: "Estadio de prueba 22",
        siguientePartidoId: "eliminatoria_027",
        siguienteSlot: "VISITANTE",
    },
    {
        id: "eliminatoria_023",
        equipoLocal: "Por definir",
        equipoVisitante: "Por definir",
        fecha: "2026-07-11T13:00:00-06:00",
        fase: "Eliminatoria",
        ronda: "Octavos",
        sede: "Estadio de prueba 23",
        siguientePartidoId: "eliminatoria_028",
        siguienteSlot: "LOCAL",
    },
    {
        id: "eliminatoria_024",
        equipoLocal: "Por definir",
        equipoVisitante: "Por definir",
        fecha: "2026-07-11T17:00:00-06:00",
        fase: "Eliminatoria",
        ronda: "Octavos",
        sede: "Estadio de prueba 24",
        siguientePartidoId: "eliminatoria_028",
        siguienteSlot: "VISITANTE",
    },

    // CUARTOS
    {
        id: "eliminatoria_025",
        equipoLocal: "Por definir",
        equipoVisitante: "Por definir",
        fecha: "2026-07-13T15:00:00-06:00",
        fase: "Eliminatoria",
        ronda: "Cuartos",
        sede: "Estadio de prueba 25",
        siguientePartidoId: "eliminatoria_029",
        siguienteSlot: "LOCAL",
    },
    {
        id: "eliminatoria_026",
        equipoLocal: "Por definir",
        equipoVisitante: "Por definir",
        fecha: "2026-07-13T19:00:00-06:00",
        fase: "Eliminatoria",
        ronda: "Cuartos",
        sede: "Estadio de prueba 26",
        siguientePartidoId: "eliminatoria_029",
        siguienteSlot: "VISITANTE",
    },
    {
        id: "eliminatoria_027",
        equipoLocal: "Por definir",
        equipoVisitante: "Por definir",
        fecha: "2026-07-14T15:00:00-06:00",
        fase: "Eliminatoria",
        ronda: "Cuartos",
        sede: "Estadio de prueba 27",
        siguientePartidoId: "eliminatoria_030",
        siguienteSlot: "LOCAL",
    },
    {
        id: "eliminatoria_028",
        equipoLocal: "Por definir",
        equipoVisitante: "Por definir",
        fecha: "2026-07-14T19:00:00-06:00",
        fase: "Eliminatoria",
        ronda: "Cuartos",
        sede: "Estadio de prueba 28",
        siguientePartidoId: "eliminatoria_030",
        siguienteSlot: "VISITANTE",
    },

    // SEMIFINALES
    {
        id: "eliminatoria_029",
        equipoLocal: "Por definir",
        equipoVisitante: "Por definir",
        fecha: "2026-07-16T15:00:00-06:00",
        fase: "Eliminatoria",
        ronda: "Semifinal",
        sede: "Estadio de prueba 29",
        siguientePartidoId: "eliminatoria_032",
        siguienteSlot: "LOCAL",
        perdedorSiguientePartidoId: "eliminatoria_031",
        perdedorSiguienteSlot: "LOCAL",
    },
    {
        id: "eliminatoria_030",
        equipoLocal: "Por definir",
        equipoVisitante: "Por definir",
        fecha: "2026-07-17T15:00:00-06:00",
        fase: "Eliminatoria",
        ronda: "Semifinal",
        sede: "Estadio de prueba 30",
        siguientePartidoId: "eliminatoria_032",
        siguienteSlot: "VISITANTE",
        perdedorSiguientePartidoId: "eliminatoria_031",
        perdedorSiguienteSlot: "VISITANTE",
    },

    // TERCER LUGAR
    {
        id: "eliminatoria_031",
        equipoLocal: "Por definir",
        equipoVisitante: "Por definir",
        fecha: "2026-07-18T15:00:00-06:00",
        fase: "Eliminatoria",
        ronda: "Tercer lugar",
        sede: "Estadio de prueba 31",
    },

    // FINAL
    {
        id: "eliminatoria_032",
        equipoLocal: "Por definir",
        equipoVisitante: "Por definir",
        fecha: "2026-07-19T15:00:00-06:00",
        fase: "Eliminatoria",
        ronda: "Final",
        sede: "Estadio de prueba 32",
    },
];

export default function CargarEliminatoriaPage() {
    const router = useRouter();
    const { usuario, perfil, cargando } = useAuth();

    const [cargandoCarga, setCargandoCarga] = useState(false);
    const [mensajeError, setMensajeError] = useState("");
    const [mensajeExito, setMensajeExito] = useState("");

    useEffect(() => {
        if (cargando) {
            return;
        }

        if (!usuario) {
            router.push("/login");
            return;
        }

        if (perfil && perfil.rol !== "admin") {
            router.push("/quiniela");
        }
    }, [usuario, perfil, cargando, router]);

    async function cargarPartidos() {
        setCargandoCarga(true);
        setMensajeError("");
        setMensajeExito("");

        try {
            const batch = writeBatch(db);

            partidosEliminatoria.forEach((partido) => {
                const partidoRef = doc(collection(db, "matches"), partido.id);

                batch.set(
                    partidoRef,
                    {
                        equipoLocal: partido.equipoLocal,
                        equipoVisitante: partido.equipoVisitante,
                        fecha: Timestamp.fromDate(new Date(partido.fecha)),
                        fase: partido.fase,
                        ronda: partido.ronda,
                        grupo: partido.ronda,
                        sede: partido.sede,

                        tipoPartido: "eliminatoria",
                        permitePenales: true,

                        siguientePartidoId: partido.siguientePartidoId ?? null,
                        siguienteSlot: partido.siguienteSlot ?? null,

                        perdedorSiguientePartidoId: partido.perdedorSiguientePartidoId ?? null,
                        perdedorSiguienteSlot: partido.perdedorSiguienteSlot ?? null,

                        estado: "programado",
                        golesLocal: null,
                        golesVisitante: null,
                        ganadorPenales: null,
                        clasificado: null,

                        creadoEn: serverTimestamp(),
                        actualizadoEn: serverTimestamp(),
                    },
                    { merge: true }
                );
            });

            await batch.commit();

            setMensajeExito(
                `Se cargaron ${partidosEliminatoria.length} partidos de eliminatoria correctamente.`
            );
        } catch (error) {
            console.error(error);
            setMensajeError("No se pudieron cargar los partidos de eliminatoria.");
        } finally {
            setCargandoCarga(false);
        }
    }

    if (cargando) {
        return <Loader texto="Validando acceso..." />;
    }

    if (!usuario || perfil?.rol !== "admin") {
        return <Loader texto="Redirigiendo..." />;
    }

    return (
        <PageContainer>
            <AppHeader />

            <div className="mb-8">
                <p className="text-sm font-semibold text-blue-600">
                    Herramienta temporal
                </p>

                <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                    Cargar partidos de eliminatoria
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                    Esta página carga partidos de prueba para validar la pantalla de ronda
                    eliminatoria. Solo debe usarse en ambiente de prueba o mientras se
                    prepara la carga oficial.
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

            <Card className="mb-6">
                <h2 className="text-xl font-black text-slate-900">
                    Partidos a cargar
                </h2>

                <p className="mt-2 text-sm text-slate-600">
                    Se crearán o actualizarán documentos en la colección{" "}
                    <span className="font-black">matches</span> con{" "}
                    <span className="font-black">tipoPartido: "eliminatoria"</span>.
                </p>

                <div className="mt-5 overflow-x-auto">
                    <table className="w-full min-w-[700px] border-collapse text-left text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 text-slate-500">
                                <th className="py-3 pr-4 font-semibold">ID</th>
                                <th className="py-3 pr-4 font-semibold">Partido</th>
                                <th className="py-3 pr-4 font-semibold">Ronda</th>
                                <th className="py-3 pr-4 font-semibold">Fecha</th>
                            </tr>
                        </thead>

                        <tbody>
                            {partidosEliminatoria.map((partido) => (
                                <tr
                                    key={partido.id}
                                    className="border-b border-slate-100 last:border-b-0"
                                >
                                    <td className="py-3 pr-4 font-mono text-xs text-slate-500">
                                        {partido.id}
                                    </td>

                                    <td className="py-3 pr-4 font-bold text-slate-900">
                                        {partido.equipoLocal} vs {partido.equipoVisitante}
                                    </td>

                                    <td className="py-3 pr-4 text-slate-600">
                                        {partido.ronda}
                                    </td>

                                    <td className="py-3 pr-4 text-slate-600">
                                        {new Date(partido.fecha).toLocaleString("es-HN", {
                                            dateStyle: "medium",
                                            timeStyle: "short",
                                        })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-6">
                    <Button
                        type="button"
                        onClick={cargarPartidos}
                        disabled={cargandoCarga}
                    >
                        {cargandoCarga
                            ? "Cargando partidos..."
                            : "Cargar partidos de eliminatoria"}
                    </Button>
                </div>
            </Card>

            <Card className="border-amber-200 bg-amber-50">
                <h2 className="text-lg font-black text-amber-900">
                    Importante
                </h2>

                <p className="mt-2 text-sm leading-6 text-amber-800">
                    Esta página es temporal. Cuando termines de cargar los partidos,
                    puedes eliminar la carpeta{" "}
                    <span className="font-black">src/app/dev/cargar-eliminatoria</span>{" "}
                    para evitar que se use accidentalmente.
                </p>
            </Card>
        </PageContainer>
    );
}