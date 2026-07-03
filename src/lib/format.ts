// Formato CLP: $1.234.567 (punto separador de miles, sin decimales)
export function clp(monto: number): string {
  const abs = Math.round(Math.abs(monto));
  const miles = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${monto < 0 ? "-" : ""}$${miles}`;
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// "2026-07" -> "julio 2026"
export function nombreMes(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  return `${MESES[m - 1]} ${y}`;
}

// "2026-07" -> "Jul 26"
export function nombreMesCorto(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  const corto = MESES[m - 1].slice(0, 3);
  return `${corto[0].toUpperCase()}${corto.slice(1)} ${String(y).slice(2)}`;
}

export function mesActual(): string {
  return hoyLocal().slice(0, 7);
}

// Fecha de hoy en zona horaria de Chile, YYYY-MM-DD
export function hoyLocal(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Suma n meses a un YYYY-MM
export function sumarMeses(mes: string, n: number): string {
  const [y, m] = mes.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

// Meses transcurridos entre dos YYYY-MM (b - a)
export function mesesEntre(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by * 12 + bm) - (ay * 12 + am);
}

// Normaliza texto para aliases: minúsculas, sin tildes, sin números ni símbolos
export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\d.,$]+/g, " ")
    .replace(/[^a-zñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Extrae el monto de un texto libre tipo "bencina 48.200" o "super 89225 jose"
export function extraerMonto(texto: string): number | null {
  // números con separador de miles chileno o simples
  const matches = texto.match(/\d{1,3}(?:\.\d{3})+|\d+/g);
  if (!matches) return null;
  // el número más grande suele ser el monto
  const montos = matches.map((m) => parseInt(m.replace(/\./g, ""), 10));
  const max = Math.max(...montos);
  return max > 0 ? max : null;
}
