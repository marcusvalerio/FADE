import { NextRequest, NextResponse } from "next/server"
import Groq from "groq-sdk"
import { supabaseServer } from "@/lib/supabase-server"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const TIPO_LABEL: Record<string, string> = {
  post: "post de feed",
  story: "story",
  reel_script: "roteiro de Reels",
  legenda: "legenda standalone",
  promocao: "post promocional",
}

function montarPrompt(marca: {
  nome: string; cidade: string; tipo: string; servicos: string[]
  publico: string[]; tom: string; palavras?: string[]
}, tipo: string, rede: string, tema?: string) {
  return `Você é um especialista em marketing para barbearias brasileiras.

PERFIL DA MARCA:
- Nome: ${marca.nome}
- Cidade: ${marca.cidade}
- Tipo: ${marca.tipo}
- Serviços: ${marca.servicos.join(", ")}
- Público: ${marca.publico.join(", ")}
- Tom de voz: ${marca.tom}
${marca.palavras?.length ? `- Palavras/expressões típicas do público: ${marca.palavras.join(", ")}` : ""}

TAREFA:
Crie um ${TIPO_LABEL[tipo] || "post"} para ${rede}${tema ? ` sobre: ${tema}` : ""}.

Retorne APENAS um JSON válido.
Nunca utilize markdown.
Nunca utilize \`\`\`json.

Responda exatamente no formato abaixo:
{
  "titulo": "",
  "conteudo": "",
  "cta": "",
  "hashtags": []
}

Regras:
- Tom de voz: ${marca.tom}.
- Nunca use emoji em excesso (no máximo 2-3 no texto todo).
- "titulo": título curto interno para identificar o conteúdo (não aparece no post).
- "conteudo": o texto do post/legenda/roteiro completo, sem incluir o CTA nem as hashtags.
- "cta": uma chamada para ação curta e direta, separada do corpo do texto.
- "hashtags": array de 4 a 6 hashtags em português, relevantes para barbearia e cidade (${marca.cidade}), sem o caractere #.
- Se for roteiro de Reels, estruture "conteudo" em cenas curtas (Cena 1, Cena 2...) com indicação visual.
- Nunca invente promoções, preços ou disponibilidade que não foram informados.`
}

async function gerarComGroq(prompt: string) {
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 1024,
    temperature: 0.7,
  })
  return completion.choices[0]?.message?.content || "{}"
}

// Reset automático do contador mensal — chamado a cada geração
async function verificarResetMensal(supabase: Awaited<ReturnType<typeof supabaseServer>>, userId: string) {
  const { data: assin } = await supabase
    .from("assinaturas")
    .select("conteudos_usados_mes, ciclo_inicio")
    .eq("user_id", userId)
    .single()

  if (!assin) return

  const hoje = new Date()
  const cicloInicio = assin.ciclo_inicio ? new Date(assin.ciclo_inicio) : null

  const precisaResetar = !cicloInicio ||
    hoje.getFullYear() > cicloInicio.getFullYear() ||
    hoje.getMonth() > cicloInicio.getMonth()

  if (precisaResetar) {
    await supabase
      .from("assinaturas")
      .update({
        conteudos_usados_mes: 0,
        ciclo_inicio: hoje.toISOString().split("T")[0],
      })
      .eq("user_id", userId)
  }
}

export async function POST(request: NextRequest) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const { marca_id, tipo, rede, tema, data_agendada } = await request.json()

  // Reset automático antes de verificar limite
  await verificarResetMensal(supabase, user.id)

  const { data: assinatura } = await supabase
    .from("assinaturas")
    .select("plano_id, conteudos_usados_mes")
    .eq("user_id", user.id)
    .single()

  const { data: plano } = await supabase
    .from("planos")
    .select("limite_conteudos_mes")
    .eq("id", assinatura?.plano_id || "free")
    .single()

  if (assinatura && plano && assinatura.conteudos_usados_mes >= plano.limite_conteudos_mes) {
    return NextResponse.json({
      error: "Limite de conteúdos do plano atingido. Faça upgrade para continuar.",
      tipo: "limite_atingido"
    }, { status: 403 })
  }

  const { data: marca } = await supabase
    .from("marcas")
    .select("*")
    .eq("id", marca_id)
    .eq("user_id", user.id)
    .single()

  if (!marca) return NextResponse.json({ error: "Marca não encontrada" }, { status: 404 })

  const prompt = montarPrompt(marca, tipo, rede, tema)

  let raw = ""
  try {
    raw = await gerarComGroq(prompt)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ""
    if (msg.includes("rate_limit") || msg.includes("429")) {
      return NextResponse.json({ error: "Muitas requisições seguidas. Aguarda alguns segundos e tenta de novo." }, { status: 429 })
    }
    return NextResponse.json({ error: "Erro ao gerar conteúdo. Tente novamente." }, { status: 500 })
  }

  let parsed: { titulo: string; conteudo: string; cta?: string; hashtags: string[] }
  try {
    const clean = raw.replace(/```json|```/g, "").trim()
    parsed = JSON.parse(clean)
  } catch {
    // Tenta extrair JSON caso o modelo tenha retornado texto extra
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: "A IA retornou um formato inesperado. Tenta gerar de novo." }, { status: 500 })
    try {
      parsed = JSON.parse(match[0])
    } catch {
      return NextResponse.json({ error: "Não conseguimos interpretar o conteúdo gerado. Tenta de novo." }, { status: 500 })
    }
  }

  const conteudoFinal = parsed.cta
    ? `${parsed.conteudo}\n\n${parsed.cta}`
    : parsed.conteudo

  const { data: novoConteudo, error: insertError } = await supabase
    .from("conteudos")
    .insert({
      marca_id,
      user_id: user.id,
      tipo,
      rede,
      titulo: parsed.titulo,
      conteudo: conteudoFinal,
      hashtags: parsed.hashtags || [],
      status: data_agendada ? "agendado" : "rascunho",
      data_agendada: data_agendada || null,
    })
    .select()
    .single()

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 })

  const novoUso = (assinatura?.conteudos_usados_mes || 0) + 1
  await supabase
    .from("assinaturas")
    .update({ conteudos_usados_mes: novoUso })
    .eq("user_id", user.id)

  let aviso: string | null = null
  if (plano && novoUso === Math.ceil(plano.limite_conteudos_mes * 0.8)) {
    aviso = "Você já usou 80% dos conteúdos deste mês. Considere um upgrade para não ficar sem."
  }

  return NextResponse.json({ conteudo: novoConteudo, aviso })
}
