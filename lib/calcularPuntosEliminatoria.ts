export type EquipoGanador = "LOCAL" | "VISITANTE" | null;

export type CalculoEliminatoriaInput = {
  golesLocalReal: number;
  golesVisitanteReal: number;
  golesLocalPredicho: number;
  golesVisitantePredicho: number;

  /**
   * Solo se usa cuando el partido real terminó empatado.
   * Ejemplo: LOCAL ganó en penales.
   */
  ganadorPenalesReal?: EquipoGanador;

  /**
   * Solo se usa cuando la predicción terminó empatada.
   * Ejemplo: el usuario predijo empate y eligió que gana LOCAL en penales.
   */
  ganadorPenalesPredicho?: EquipoGanador;
};

export type ResultadoCalculoEliminatoria = {
  puntosExacto: number;
  puntosGanador: number;
  puntosDiferencia: number;
  puntosPenales: number;
  puntosTotales: number;

  acertoExacto: boolean;
  acertoGanador: boolean;
  acertoDiferencia: boolean;
  acertoPenales: boolean;

  ganadorReal: EquipoGanador;
  ganadorPredicho: EquipoGanador;
};

function obtenerGanadorNormal(
  golesLocal: number,
  golesVisitante: number
): EquipoGanador {
  if (golesLocal > golesVisitante) return "LOCAL";
  if (golesVisitante > golesLocal) return "VISITANTE";
  return null;
}

function obtenerGanadorEliminatoria(
  golesLocal: number,
  golesVisitante: number,
  ganadorPenales?: EquipoGanador
): EquipoGanador {
  const ganadorNormal = obtenerGanadorNormal(golesLocal, golesVisitante);

  if (ganadorNormal) {
    return ganadorNormal;
  }

  return ganadorPenales ?? null;
}

export function calcularPuntosEliminatoria({
  golesLocalReal,
  golesVisitanteReal,
  golesLocalPredicho,
  golesVisitantePredicho,
  ganadorPenalesReal,
  ganadorPenalesPredicho,
}: CalculoEliminatoriaInput): ResultadoCalculoEliminatoria {
  const marcadorExacto =
    golesLocalReal === golesLocalPredicho &&
    golesVisitanteReal === golesVisitantePredicho;

  const diferenciaReal = golesLocalReal - golesVisitanteReal;
  const diferenciaPredicha = golesLocalPredicho - golesVisitantePredicho;

  const acertoDiferencia = diferenciaReal === diferenciaPredicha;

  const ganadorReal = obtenerGanadorEliminatoria(
    golesLocalReal,
    golesVisitanteReal,
    ganadorPenalesReal
  );

  const ganadorPredicho = obtenerGanadorEliminatoria(
    golesLocalPredicho,
    golesVisitantePredicho,
    ganadorPenalesPredicho
  );

  const acertoGanador =
    ganadorReal !== null &&
    ganadorPredicho !== null &&
    ganadorReal === ganadorPredicho;

  const partidoRealSeFueAPenales =
    golesLocalReal === golesVisitanteReal && ganadorPenalesReal !== null;

  const prediccionSeFueAPenales =
    golesLocalPredicho === golesVisitantePredicho &&
    ganadorPenalesPredicho !== null;

  const acertoPenales =
    partidoRealSeFueAPenales &&
    prediccionSeFueAPenales &&
    ganadorPenalesReal === ganadorPenalesPredicho;

  const puntosExacto = marcadorExacto ? 3 : 0;
  const puntosGanador = acertoGanador ? 1 : 0;
  const puntosDiferencia = acertoDiferencia ? 2 : 0;
  const puntosPenales = acertoPenales ? 1 : 0;

  const puntosTotales =
    puntosExacto + puntosGanador + puntosDiferencia + puntosPenales;

  return {
    puntosExacto,
    puntosGanador,
    puntosDiferencia,
    puntosPenales,
    puntosTotales,

    acertoExacto: marcadorExacto,
    acertoGanador,
    acertoDiferencia,
    acertoPenales,

    ganadorReal,
    ganadorPredicho,
  };
}