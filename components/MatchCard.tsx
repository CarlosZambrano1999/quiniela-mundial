"use client";

import { FormEvent } from "react";
import { Timestamp } from "firebase/firestore";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

export type Partido = {
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

export type PrediccionPartido = {
  golesLocalPredicho: string;
  golesVisitantePredicho: string;
  guardada: boolean;
};

type MatchCardProps = {
  partido: Partido;
  prediccion?: PrediccionPartido;
  bloqueado: boolean;
  yaInicio: boolean;
  guardando: boolean;
  onCambiarPrediccion: (
    matchId: string,
    campo: "golesLocalPredicho" | "golesVisitantePredicho",
    valor: string
  ) => void;
  onGuardarPrediccion: (
    event: FormEvent<HTMLFormElement>,
    partido: Partido
  ) => void;
};

export default function MatchCard({
  partido,
  prediccion,
  bloqueado,
  yaInicio,
  guardando,
  onCambiarPrediccion,
  onGuardarPrediccion,
}: MatchCardProps) {
  function formatearFecha(fechaPartido: Timestamp) {
    return fechaPartido.toDate().toLocaleString("es-HN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function obtenerTextoEstado() {
    if (partido.estado === "programado" && yaInicio) {
      return "cerrado por hora";
    }

    return partido.estado;
  }

  function obtenerVarianteEstado() {
    if (partido.estado === "finalizado") {
      return "green";
    }

    if (bloqueado) {
      return "amber";
    }

    return "blue";
  }

  return (
    <Card>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="blue">{partido.fase}</Badge>
            <Badge>{partido.grupo}</Badge>
            <Badge variant={obtenerVarianteEstado()}>
              {obtenerTextoEstado()}
            </Badge>
          </div>

          <h2 className="mt-4 text-2xl font-black text-slate-900">
            {partido.equipoLocal} vs {partido.equipoVisitante}
          </h2>

          <p className="mt-1 text-sm font-medium text-slate-500">
            {formatearFecha(partido.fecha)}
          </p>

          {partido.estado === "finalizado" && (
            <p className="mt-3 text-sm font-semibold text-slate-700">
              Resultado final:{" "}
              <span className="text-slate-900">
                {partido.golesLocal} - {partido.golesVisitante}
              </span>
            </p>
          )}
        </div>

        <form
          onSubmit={(event) => onGuardarPrediccion(event, partido)}
          className="rounded-2xl bg-slate-50 p-4"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                {partido.equipoLocal}
              </label>

              <input
                type="number"
                min="0"
                value={prediccion?.golesLocalPredicho ?? ""}
                onChange={(event) =>
                  onCambiarPrediccion(
                    partido.id,
                    "golesLocalPredicho",
                    event.target.value
                  )
                }
                disabled={bloqueado}
                className="mt-1 w-24 rounded-xl border border-slate-300 bg-white px-3 py-3 text-center text-lg font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100 disabled:text-slate-400"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                {partido.equipoVisitante}
              </label>

              <input
                type="number"
                min="0"
                value={prediccion?.golesVisitantePredicho ?? ""}
                onChange={(event) =>
                  onCambiarPrediccion(
                    partido.id,
                    "golesVisitantePredicho",
                    event.target.value
                  )
                }
                disabled={bloqueado}
                className="mt-1 w-24 rounded-xl border border-slate-300 bg-white px-3 py-3 text-center text-lg font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100 disabled:text-slate-400"
                placeholder="0"
              />
            </div>

            <Button type="submit" disabled={bloqueado || guardando}>
              {guardando
                ? "Guardando..."
                : prediccion?.guardada
                  ? "Actualizar"
                  : "Guardar"}
            </Button>
          </div>

          {prediccion?.guardada && !bloqueado && (
            <p className="mt-3 text-sm font-semibold text-green-700">
              Predicción guardada: {prediccion.golesLocalPredicho} -{" "}
              {prediccion.golesVisitantePredicho}
            </p>
          )}
        </form>
      </div>

      {bloqueado && (
        <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
          {partido.estado !== "programado"
            ? "Este partido ya no permite registrar o modificar predicciones."
            : "Ya no puedes registrar o modificar esta predicción porque el partido ya inició."}
        </p>
      )}
    </Card>
  );
}