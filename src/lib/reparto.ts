import type { Transaction, User } from "./types";

// Balance de pareja.
// Convención: balance > 0 => Josefina le debe a Javier; balance < 0 => Javier le debe a Josefina.
//
// - "compartido": Josefina debe factor (27,5%) y Javier (1 - factor), contra quién pagó.
// - "de_javier" pagada por Josefina: Javier le debe el 100% (y viceversa).
// - "de_javier" pagada por Javier: no genera deuda.
// - "abono": transferencia directa que reduce la deuda del que abona.
export function deudaDeTransaccion(
  t: Pick<Transaction, "monto" | "tipo_reparto" | "pagador_id">,
  javierId: string,
  josefinaId: string,
  factorJosefina: number
): number {
  const pagoJavier = t.pagador_id === javierId;
  const pagoJosefina = t.pagador_id === josefinaId;
  if (!pagoJavier && !pagoJosefina) return 0;

  switch (t.tipo_reparto) {
    case "compartido":
      // El que no pagó le debe su parte al que pagó
      return pagoJavier
        ? t.monto * factorJosefina // Josefina debe su 27,5% a Javier
        : -(t.monto * (1 - factorJosefina)); // Javier debe su 72,5% a Josefina
    case "de_javier":
      // Gasto 100% de Javier
      return pagoJosefina ? -t.monto : 0; // si lo pagó Josefina, Javier le debe todo
    case "de_josefina":
      return pagoJavier ? t.monto : 0; // si lo pagó Javier, Josefina le debe todo
    case "abono":
      // El que abona reduce su deuda: si abona Josefina, baja lo que le debe a Javier
      return pagoJosefina ? -t.monto : t.monto;
  }
}

export function balanceDeTransacciones(
  transacciones: Pick<Transaction, "monto" | "tipo_reparto" | "pagador_id">[],
  javierId: string,
  josefinaId: string,
  factorJosefina: number
): number {
  return transacciones.reduce(
    (acc, t) => acc + deudaDeTransaccion(t, javierId, josefinaId, factorJosefina),
    0
  );
}

export function textoBalance(balance: number): string {
  const redondeado = Math.round(balance);
  if (redondeado === 0) return "Están a mano";
  return redondeado > 0
    ? "Josefina le debe a Javier"
    : "Javier le debe a Josefina";
}

export function usuarioPorNombre(users: User[], nombre: "Javier" | "Josefina"): User | undefined {
  return users.find((u) => u.nombre === nombre);
}
