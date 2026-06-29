"use client";

import { FormEvent } from "react";
import { Timestamp } from "firebase/firestore";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

export type EquipoGanador = "LOCAL" | "VISITANTE" | null;

export type PartidoEliminatoria = {
  id: string;
  equipoLocal: string;
  equipoVisitante: string;
  fecha: Timestamp;
  fase: string;
  grupo?: string;
  ronda?: string;
  tipoPartido?: "grupos" | "eliminatoria";
  estado: "programado" | "en_juego" | "finalizado";
  golesLocal: number | null;
  golesVisitante: number | null;
  permitePenales?: boolean;
  ganadorPenales?: EquipoGanador;
  clasificado?: EquipoGanador;
};

export type PrediccionEliminatoria = {
  golesLocalPredicho: string;
  golesVisitantePredicho: string;
  ganadorPenalesPredicho: EquipoGanador;
  guardada: boolean;
};

type KnockoutMatchCardProps = {
  partido: PartidoEliminatoria;
  prediccion?: PrediccionEliminatoria;
  bloqueado: boolean;
  yaInicio: boolean;
  guardando: boolean;
  onCambiarPrediccion: (
    matchId: string,
    campo:
      | "golesLocalPredicho"
      | "golesVisitantePredicho"
      | "ganadorPenalesPredicho",
    valor: string
  ) => void;
  onGuardarPrediccion: (
    event: FormEvent<HTMLFormElement>,
    partido: PartidoEliminatoria
  ) => void;
};

export default function KnockoutMatchCard({
  partido,
  prediccion,
  bloqueado,
  yaInicio,
  guardando,
  onCambiarPrediccion,
  onGuardarPrediccion,
}: KnockoutMatchCardProps) {
  const golesLocalPredicho = prediccion?.golesLocalPredicho ?? "";
  const golesVisitantePredicho = prediccion?.golesVisitantePredicho ?? "";
  const ganadorPenalesPredicho = prediccion?.ganadorPenalesPredicho ?? null;

  const prediccionEsEmpate =
    golesLocalPredicho !== "" &&
    golesVisitantePredicho !== "" &&
    Number(golesLocalPredicho) === Number(golesVisitantePredicho);

  const mostrarSelectorPenales =
    partido.permitePenales !== false && prediccionEsEmpate;

  function formatearFecha() {
    return partido.fecha.toDate().toLocaleString("es-HN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function obtenerEstadoVisual() {
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

    if (yaInicio) {
      return {
        texto: "Cerrado",
        variant: "amber" as const,
      };
    }

    return {
      texto: "Disponible",
      variant: "blue" as const,
    };
  }

  function obtenerTextoClasificado() {
    if (!partido.clasificado) {
      return null;
    }

    if (partido.clasificado === "LOCAL") {
      return partido.equipoLocal;
    }

    return partido.equipoVisitante;
  }

  const estadoVisual = obtenerEstadoVisual();
  const textoClasificado = obtenerTextoClasificado();

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-slate-200 bg-slate-50 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={estadoVisual.variant}>{estadoVisual.texto}</Badge>
              <Badge>{partido.ronda ?? partido.fase}</Badge>
              <Badge>Eliminatoria</Badge>
            </div>

            <h2 className="mt-3 text-2xl font-black leading-tight text-slate-900">
              {partido.equipoLocal} vs {partido.equipoVisitante}
            </h2>

            <p className="mt-1 text-sm font-semibold text-slate-500">
              {formatearFecha()}
            </p>
          </div>

          {partido.estado === "finalizado" &&
            partido.golesLocal !== null &&
            partido.golesVisitante !== null && (
              <div className="rounded-2xl bg-slate-900 px-5 py-4 text-center text-white">
                <p className="text-xs font-bold uppercase text-slate-300">
                  Resultado
                </p>

                <p className="mt-1 text-3xl font-black">
                  {partido.golesLocal} - {partido.golesVisitante}
                </p>

                {textoClasificado && (
                  <p className="mt-1 text-xs font-semibold text-slate-300">
                    Clasifica: {textoClasificado}
                  </p>
                )}
              </div>
            )}
        </div>
      </div>

      <form
        onSubmit={(event) => onGuardarPrediccion(event, partido)}
        className="p-4 sm:p-5"
      >
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
          <div>
            <label className="mb-2 block text-center text-sm font-black text-slate-700">
              {partido.equipoLocal}
            </label>

            <input
              type="number"
              min="0"
              value={golesLocalPredicho}
              disabled={bloqueado || guardando}
              onChange={(event) =>
                onCambiarPrediccion(
                  partido.id,
                  "golesLocalPredicho",
                  event.target.value
                )
              }
              className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-4 text-center text-3xl font-black text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              placeholder="0"
            />
          </div>

          <div className="pb-4 text-2xl font-black text-slate-400">-</div>

          <div>
            <label className="mb-2 block text-center text-sm font-black text-slate-700">
              {partido.equipoVisitante}
            </label>

            <input
              type="number"
              min="0"
              value={golesVisitantePredicho}
              disabled={bloqueado || guardando}
              onChange={(event) =>
                onCambiarPrediccion(
                  partido.id,
                  "golesVisitantePredicho",
                  event.target.value
                )
              }
              className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-4 text-center text-3xl font-black text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              placeholder="0"
            />
          </div>
        </div>

        {mostrarSelectorPenales && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-black text-amber-800">
              Predicción empatada
            </p>

            <p className="mt-1 text-sm text-amber-700">
              Como predijiste empate, selecciona quién clasifica por penales.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={bloqueado || guardando}
                onClick={() =>
                  onCambiarPrediccion(
                    partido.id,
                    "ganadorPenalesPredicho",
                    "LOCAL"
                  )
                }
                className={`rounded-2xl border px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  ganadorPenalesPredicho === "LOCAL"
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Gana {partido.equipoLocal}
              </button>

              <button
                type="button"
                disabled={bloqueado || guardando}
                onClick={() =>
                  onCambiarPrediccion(
                    partido.id,
                    "ganadorPenalesPredicho",
                    "VISITANTE"
                  )
                }
                className={`rounded-2xl border px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  ganadorPenalesPredicho === "VISITANTE"
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Gana {partido.equipoVisitante}
              </button>
            </div>
          </div>
        )}

        {!mostrarSelectorPenales && ganadorPenalesPredicho && !bloqueado && (
          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            Cambiaste la predicción a un marcador sin empate. Al guardar, no se
            tomará en cuenta el ganador por penales.
          </div>
        )}

        {prediccion?.guardada && (
          <div className="mt-5 rounded-2xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
            Predicción guardada.
          </div>
        )}

        {bloqueado && (
          <div className="mt-5 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600">
            Este partido ya no permite modificar predicciones.
          </div>
        )}

        <div className="mt-5">
          <Button
            type="submit"
            disabled={bloqueado || guardando}
            className="w-full justify-center"
          >
            {guardando
              ? "Guardando..."
              : prediccion?.guardada
                ? "Actualizar predicción"
                : "Guardar predicción"}
          </Button>
        </div>
      </form>
    </Card>
  );
}