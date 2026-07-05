import { NextResponse } from "next/server"
import Groq from "groq-sdk"
import { supabaseServer } from "@/lib/supabase-server"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const DATAS_COMEMORATIVAS: Record<number, string[]> = {
  1:  ["Ano Novo (1/jan)", "Dia Mundial da Paz (1/jan)"],
  2:  ["Carnaval", "Dia dos Namorados japoneses (14/fev — Valentine's Day)"],
  3:  ["Dia Internacional da Mulher (8/mar)", "Início do outono"],
  4:  ["Páscoa", "Dia do Índio (19/abr)"],
  5:  ["Dia das Mães (2º domingo)", "Dia do Trabalho (1/mai)"],
  6:  ["Dia dos Namorados (12/jun)", "Festa Junina", "Início do inverno"],
  7:  ["Férias escolares", "Dia do Amigo (20/jul)"],
  8:  ["Dia dos Pais (2º domingo)", "Dia do Soldado (25/ago)"],
  9:  ["Dia do Cliente (15/set)", "Dia da Independência (7/set)", "Início da primavera"],
  10: ["Dia das Crianças (12/out)", "Dia do Professor (15/out)", "Outubro Rosa"],
  11: ["Novembro Azul — saúde masculina", "Black Friday", "Dia da Consciência Negra (20/nov)"],
  12: ["Natal (25/dez)", "Réveillon", "Fim de ano — retrospectiva"],
}

function montarPromptSugestoes(marca: {
  nome: string; tipo: string; servicos: string[];
  publico: string[]; tom: string; palavras?: string[]
}, mes: number, ano: number) {
  const nomeMes = new Date(ano, mes - 1, 1).toLocaleString("pt-BR", { month: "long" })
  const datas = DATAS_COMEMORATIVAS[mes] || []

  return `Você é um estrategista de conteúdo especializado em barbearias brasileiras.

PERFIL DA MARCA:
- Nome: ${marca.nome}
- Tipo: ${marca.tipo}
- Serviços: ${marca.servicos.join(", ")}
- Público: ${marca.publico.join(", ")}
- Tom de voz: ${marca.tom}
${marca.palavras?.length ? `- Palavras do público: ${marca.palavras.join(", ")}` : ""}

MÊS: ${nomeMes} de ${ano}
DATAS COMEMORATIVAS DO MÊS: ${datas.length ? datas.join(", ") : "Nenhuma específica"}

TAREFA:
Gere exatamente 8 sugestões de pauta para ${marca.nome} neste mês.
- 3 sugestões baseadas em datas comemorativas do mês (se houver)
- 5 sugestões originais que não dependem de data (bastidores, dicas, depoimento, rotina, técnica, estilo, etc.)

Retorne APENAS um JSON válido, sem markdown, sem crases.

Formato exato:
{
  "mes": "${nomeMes}",
  "sugestoes": [
    {
      "titulo": "título curto e direto da sugestão",
      "descricao": "uma frase explicando o conteúdo",
      "tema": "o tema exato para usar no gerador de conteúdo",
      "tipo": "post" | "story" | "reel_script" | "legenda" | "promocao",
      "tag": "data" | "original"
    }
  ]
}

Regras:
- Temas práticos e específicos, não genéricos. Ex: "bastidores da preparação da navalha antes do atendimento" em vez de "bastidores"
- Tom: ${marca.tom}
- Nunca repita sugestões óbvias como "poste uma foto do salão"
- Priorize conteúdo que gera engajamento real (pergunta pra audiência, dica útil, antes/depois, depoimento)`
}

export async function GET() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const { data: marca } = await supabase
    .from("marcas")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle()

  if (!marca) return NextResponse.json({ error: "Marca não encontrada. Complete o perfil primeiro." }, { status: 404 })

  const hoje = new Date()
  const mes = hoje.getMonth() + 1
  const ano = hoje.getFullYear()

  const prompt = montarPromptSugestoes(marca, mes, ano)

  let raw = ""
  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2048,
      temperature: 0.75,
    })
    raw = completion.choices[0]?.message?.content || "{}"
  } catch {
    return NextResponse.json({ error: "Erro ao gerar sugestões. Tenta de novo." }, { status: 500 })
  }

  try {
    const clean = raw.replace(/```json|```/g, "").trim()
    const parsed = JSON.parse(clean)
    return NextResponse.json(parsed)
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: "Formato inesperado. Tenta de novo." }, { status: 500 })
    try {
      const parsed = JSON.parse(match[0])
      return NextResponse.json(parsed)
    } catch {
      return NextResponse.json({ error: "Não conseguimos interpretar as sugestões. Tenta de novo." }, { status: 500 })
    }
  }
}
