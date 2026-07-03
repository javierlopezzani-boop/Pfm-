import { mesActual, mesesEntre, sumarMeses } from "./format";
import type { Category, Installment, Settings, Transaction } from "./types";

export interface MesProyectado {
  mes: string; // YYYY-MM
  sueldo: number;
  cuotas: number;
  gastosFijos: number; // gasto depto (parte de Javier) + personales de Javier — real o presupuestado
  pptoVariable: number;
  ahorro: number;
  apv: number;
  saldoMes: number;
  saldoAcumulado: number;
  esReal: boolean; // true si usa gasto real (mes en curso o pasado)
  cuotasDetalle: { detalle: string; monto: number }[];
}

// Una cuota está activa en el mes M si fecha_inicio <= M
// y las cuotas transcurridas por calendario < total_cuotas.
export function cuotaActivaEnMes(inst: Installment, mes: string): boolean {
  const mesInicio = inst.fecha_inicio.slice(0, 7);
  const transcurridas = mesesEntre(mesInicio, mes);
  return transcurridas >= 0 && transcurridas < inst.total_cuotas;
}

export function cuotasRestantes(inst: Installment, desde?: string): number {
  const mes = desde ?? mesActual();
  const mesInicio = inst.fecha_inicio.slice(0, 7);
  const transcurridas = Math.max(0, mesesEntre(mesInicio, mes));
  return Math.max(0, inst.total_cuotas - transcurridas);
}

// Gasto real de Javier en un mes: transacciones depto ajustadas por reparto
// (paga 1 - factor de lo compartido, 100% de lo suyo) + personales suyas.
export function gastoRealJavierEnMes(
  transacciones: Transaction[],
  categoriasPorId: Map<string, Category>,
  javierId: string,
  factorJosefina: number,
  mes: string
): number {
  let total = 0;
  for (const t of transacciones) {
    if (t.mes !== mes) continue;
    if (t.tipo_reparto === "abono") continue; // transferencias no son gasto
    if (t.tipo_reparto === "compartido") {
      total += t.monto * (1 - factorJosefina);
    } else if (t.tipo_reparto === "de_javier") {
      total += t.monto;
    }
    // de_josefina: no es gasto de Javier
  }
  return Math.round(total);
}

export function proyeccion12Meses(params: {
  settings: Settings;
  categorias: Category[];
  installments: Installment[];
  transacciones: Transaction[]; // del mes en curso (y pasados si se quisiera)
  javierId: string;
  desde?: string; // YYYY-MM, default mes actual
}): MesProyectado[] {
  const { settings, categorias, installments, transacciones, javierId } = params;
  const inicio = params.desde ?? mesActual();
  const actual = mesActual();
  const factorJavier = 1 - settings.factor_reparto_josefina;

  const pptoDeptoTotal = categorias
    .filter((c) => c.ambito === "depto" && c.activa)
    .reduce((acc, c) => acc + c.presupuesto_mensual, 0);
  const gastosFijosProyectados = Math.round(pptoDeptoTotal * factorJavier);

  const categoriasPorId = new Map(categorias.map((c) => [c.id, c]));

  const meses: MesProyectado[] = [];
  let acumulado = 0;

  for (let i = 0; i < 12; i++) {
    const mes = sumarMeses(inicio, i);
    const esReal = mesesEntre(mes, actual) >= 0; // mes actual o pasado

    const cuotasDetalle = installments
      .filter((inst) => cuotaActivaEnMes(inst, mes))
      .map((inst) => ({ detalle: inst.detalle, monto: inst.monto_cuota }));
    const cuotas = cuotasDetalle.reduce((a, c) => a + c.monto, 0);

    const gastosFijos = esReal
      ? gastoRealJavierEnMes(
          transacciones,
          categoriasPorId,
          javierId,
          settings.factor_reparto_josefina,
          mes
        )
      : gastosFijosProyectados;

    const saldoMes =
      settings.sueldo_liquido -
      cuotas -
      gastosFijos -
      settings.ppto_variable_mensual -
      settings.ahorro_mensual -
      settings.apv_mensual;

    acumulado += saldoMes;

    meses.push({
      mes,
      sueldo: settings.sueldo_liquido,
      cuotas,
      gastosFijos,
      pptoVariable: settings.ppto_variable_mensual,
      ahorro: settings.ahorro_mensual,
      apv: settings.apv_mensual,
      saldoMes,
      saldoAcumulado: acumulado,
      esReal,
      cuotasDetalle,
    });
  }

  return meses;
}

// Primer mes donde el saldo mensual pasa de negativo a positivo
export function mesDeCruce(meses: MesProyectado[]): string | null {
  for (let i = 1; i < meses.length; i++) {
    if (meses[i - 1].saldoMes < 0 && meses[i].saldoMes >= 0) return meses[i].mes;
  }
  return null;
}
