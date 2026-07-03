import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extraerMonto } from "@/lib/format";

export const dynamic = "force-dynamic";

// Categoriza un texto libre ("bencina 48.200", "super lider 89.225 jose")
// usando claude-haiku. El alias-matching instantáneo ocurre en el cliente;
// esta ruta solo se llama cuando no hay alias.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { texto, categorias } = (await request.json()) as {
    texto: string;
    categorias: string[];
  };

  if (!texto || !Array.isArray(categorias) || categorias.length === 0) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY no configurada" },
      { status: 503 }
    );
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 256,
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              categoria: { type: "string", enum: categorias },
              monto: { type: "integer" },
              pagador_sugerido: { type: "string", enum: ["Javier", "Josefina"] },
              tipo_reparto_sugerido: {
                type: "string",
                enum: ["compartido", "de_javier", "de_josefina", "abono"],
              },
            },
            required: [
              "categoria",
              "monto",
              "pagador_sugerido",
              "tipo_reparto_sugerido",
            ],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: "user",
          content: `Eres el categorizador de una app de finanzas de la pareja Javier y Josefina en Chile.
El usuario escribió este gasto en texto libre: "${texto}"

Categorías disponibles: ${categorias.join(", ")}.

Reglas:
- El monto está en pesos chilenos; el punto es separador de miles ("48.200" = 48200).
- Si el texto menciona "jose", "josefina" o "ella", la pagadora sugerida es Josefina; si no, Javier.
- Si dice "mía", "mío" o "personal" es tipo_reparto "de_javier" (o "de_josefina" si pagó Josefina y es de ella); si dice "abono" o "transferencia" es "abono"; en cualquier otro caso "compartido".
- Elige la categoría que mejor calce; si ninguna calza bien usa "Otros".

Responde con el JSON pedido.`,
        },
      ],
    });

    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      throw new Error("Respuesta sin texto");
    }
    const parsed = JSON.parse(block.text);

    // Respaldo: si el modelo no extrajo bien el monto, usar heurística local
    if (!parsed.monto || parsed.monto <= 0) {
      parsed.monto = extraerMonto(texto) ?? 0;
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("Error categorizando:", err);
    return NextResponse.json(
      { error: "No se pudo categorizar" },
      { status: 502 }
    );
  }
}
