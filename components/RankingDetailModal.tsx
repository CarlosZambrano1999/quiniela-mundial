"use client";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

export type TipoDetalleRanking = "exactos" | "acertados" | "perdidos";

export type PrediccionDetalleRanking = {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  matchId: string;
  equipoLocal?: string;
  equipoVisitante?: string;
  golesLocalPredicho: number;
  golesVisitantePredicho: number;
  golesLocalReal?: number;
  golesVisitanteReal?: number;
  puntos?: number;
  partidoFinalizado?: boolean;
};

type RankingDetailModalProps = {
  abierto: boolean;
  tipo: TipoDetalleRanking | null;
  participante: {
    nombre: string;
    email: string;
  } | null;
  predicciones: PrediccionDetalleRanking[];
  onCerrar: () => void;
};

export default function RankingDetailModal({
  abierto,
  tipo,
  participante,
  predicciones,
  onCerrar,
}: RankingDetailModalProps) {
  if (!abierto || !tipo || !participante) {
    return null;
  }

  const tituloPorTipo: Record<TipoDetalleRanking, string> = {
    exactos: "Marcadores exactos",
    acertados: "Aciertos por resultado",
    perdidos: "Predicciones erradas",
  };

  const descripcionPorTipo: Record<TipoDetalleRanking, string> = {
    exactos:
      "Partidos donde el participante acertó el marcador exacto y obtuvo 3 puntos.",
    acertados:
      "Partidos donde acertó el ganador o empate, pero no el marcador exacto.",
    perdidos:
      "Partidos donde no acertó el marcador ni el resultado del partido.",
  };

  const badgeVariantPorTipo: Record<
    TipoDetalleRanking,
    "green" | "blue" | "red"
  > = {
    exactos: "green",
    acertados: "blue",
    perdidos: "red",
  };

  const puntosPorTipo: Record<TipoDetalleRanking, string> = {
    exactos: "3 pts",
    acertados: "1 pt",
    perdidos: "0 pts",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 px-4 py-4 backdrop-blur-sm sm:items-center">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Badge variant={badgeVariantPorTipo[tipo]}>
                {tituloPorTipo[tipo]}
              </Badge>

              <h2 className="mt-3 text-2xl font-black text-slate-900">
                {participante.nombre || "Sin nombre"}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {participante.email}
              </p>
            </div>

            <button
              type="button"
              onClick={onCerrar}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl font-black text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100"
              aria-label="Cerrar modal"
            >
              ×
            </button>
          </div>

          <p className="mt-4 text-sm leading-6 text-slate-600">
            {descripcionPorTipo[tipo]}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <p className="text-xs font-bold uppercase text-slate-500">
                Total partidos
              </p>
              <p className="mt-1 text-3xl font-black text-slate-900">
                {predicciones.length}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <p className="text-xs font-bold uppercase text-slate-500">
                Puntos por partido
              </p>
              <p className="mt-1 text-3xl font-black text-slate-900">
                {puntosPorTipo[tipo]}
              </p>
            </div>
          </div>
        </div>

        <div className="max-h-[55vh] overflow-y-auto px-5 py-5 sm:px-6">
          {predicciones.length === 0 ? (
            <p className="text-sm text-slate-600">
              No hay predicciones para mostrar en esta categoría.
            </p>
          ) : (
            <div className="grid gap-3">
              {predicciones.map((prediccion) => (
                <div
                  key={prediccion.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-black text-slate-900">
                        {prediccion.equipoLocal || "Local"} vs{" "}
                        {prediccion.equipoVisitante || "Visitante"}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        ID partido: {prediccion.matchId}
                      </p>
                    </div>

                    <Badge variant={badgeVariantPorTipo[tipo]}>
                      {prediccion.puntos ?? 0} puntos
                    </Badge>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-slate-100 p-3 text-center">
                      <p className="text-xs font-bold uppercase text-slate-500">
                        Predicción
                      </p>
                      <p className="mt-1 text-2xl font-black text-slate-900">
                        {prediccion.golesLocalPredicho} -{" "}
                        {prediccion.golesVisitantePredicho}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-900 p-3 text-center text-white">
                      <p className="text-xs font-bold uppercase text-slate-300">
                        Resultado
                      </p>
                      <p className="mt-1 text-2xl font-black">
                        {prediccion.golesLocalReal ?? "-"} -{" "}
                        {prediccion.golesVisitanteReal ?? "-"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
          <Button type="button" variant="secondary" onClick={onCerrar}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}