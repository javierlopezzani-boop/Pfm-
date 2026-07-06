export type TipoReparto = "compartido" | "de_javier" | "de_josefina" | "abono";
export type Ambito = "depto" | "personal";

export interface User {
  id: string;
  email: string;
  nombre: "Javier" | "Josefina";
}

export interface Category {
  id: string;
  nombre: string;
  presupuesto_mensual: number;
  ambito: Ambito;
  activa: boolean;
}

export interface Transaction {
  id: string;
  fecha: string; // YYYY-MM-DD
  descripcion: string;
  monto: number;
  categoria_id: string | null;
  pagador_id: string | null;
  tipo_reparto: TipoReparto;
  mes: string; // YYYY-MM
  created_by: string | null;
  created_at: string;
}

export interface Installment {
  id: string;
  detalle: string;
  monto_cuota: number;
  total_cuotas: number;
  cuotas_pagadas: number;
  fecha_inicio: string; // YYYY-MM-DD
  ambito: string;
  activa: boolean;
}

export interface Settings {
  id: number;
  factor_reparto_josefina: number;
  sueldo_liquido: number;
  ahorro_mensual: number;
  apv_mensual: number;
  ppto_variable_mensual: number;
}

export interface MonthlySettlement {
  id: string;
  mes: string;
  monto_saldado: number;
  fecha_saldado: string;
  saldado_por: string | null;
}

export interface Investment {
  id: string;
  nombre: string;
  monto_actual: number;
  fecha_actualizacion: string;
}

export type TipoCuenta = "cuenta" | "tarjeta";

export interface Account {
  id: string;
  nombre: string;
  tipo: TipoCuenta;
  monto: number; // cuenta: saldo · tarjeta: monto utilizado
  cupo: number | null; // solo tarjetas
  orden: number;
  fecha_actualizacion: string;
}

export interface CategorizeSuggestion {
  categoria: string;
  monto: number;
  pagador_sugerido: "Javier" | "Josefina";
  tipo_reparto_sugerido: TipoReparto;
}
