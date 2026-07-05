"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Vault, Sparkles, Calendar, Lightbulb, ArrowRight, RefreshCw } from "lucide-react"
import { TabBar } from "@/components/tab-bar"

interface Sugestao {
  titulo: string
  descricao: string
  tema: string
  tipo: string
  tag: "data" | "original"
}

interface Pauta {
  mes: string
  sugestoes: Sugestao[]
}

const TIPO_LABEL: Record<string, string> = {
  post: "Post",
  story: "Story",
  reel_script: "Reels",
  legenda: "Legenda",
  promocao: "Promoção",
}

export default function Cofre() {
  const router = useRouter()
  const [pauta, setPauta] = useState<Pauta | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState("")

  const gerarSugestoes = async () => {
    setLoading(true)
    setErro("")
    try {
      const res = await fetch("/api/sugestoes")
      const data = await res.json()
      if (!res.ok) {
        setErro(data.error || "Erro ao gerar sugestões. Tenta de novo.")
        return
      }
      setPauta(data)
    } catch {
      setErro("Sem conexão. Verifica sua internet e tenta de novo.")
    } finally {
      setLoading(false)
    }
  }

  const usarSugestao = (s: Sugestao) => {
    // Passa o tema e tipo como query params pra tela de conteúdos
    const params = new URLSearchParams({ tema: s.tema, tipo: s.tipo })
    router.push(`/conteudos?${params.toString()}`)
  }

  const datasComem = pauta?.sugestoes.filter(s => s.tag === "data") || []
  const originais = pauta?.sugestoes.filter(s => s.tag === "original") || []

  return (
    <div style={{minHeight:"100vh"}}>
      <header style={{display:"flex",alignItems:"center",gap:14,padding:"16px 20px",borderBottom:"1px solid var(--border)"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <Vault size={16} style={{color:"var(--acc)"}}/>
          <span className="font-display" style={{fontSize:"1.1rem",fontWeight:700}}>Cofre da Marca</span>
        </div>
      </header>

      <main style={{maxWidth:680,margin:"0 auto",padding:"24px 20px 100px"}}>

        {/* Estado inicial — sem sugestões ainda */}
        {!pauta && !loading && (
          <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} style={{textAlign:"center",padding:"40px 20px"}}>
            <Vault size={40} style={{color:"var(--acc)",marginBottom:16,opacity:.7}}/>
            <h2 className="font-display" style={{fontSize:"1.2rem",fontWeight:700,marginBottom:8}}>
              Sua pauta do mês em segundos
            </h2>
            <p style={{fontSize:".85rem",color:"var(--fg-dim)",lineHeight:1.6,maxWidth:320,margin:"0 auto 24px"}}>
              A IA analisa o perfil da sua barbearia e sugere 8 ideias de conteúdo — baseadas em datas do mês e no que funciona pro seu público.
            </p>
            <button onClick={gerarSugestoes} className="btn-led" style={{display:"inline-flex",alignItems:"center",gap:8}}>
              <Sparkles size={15}/> Sugerir pauta de {new Date().toLocaleString("pt-BR",{month:"long"})}
            </button>
          </motion.div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{textAlign:"center",padding:"60px 20px"}}>
            <motion.div
              animate={{rotate:360}}
              transition={{duration:1.2,repeat:Infinity,ease:"linear"}}
              style={{width:28,height:28,border:"2px solid var(--border)",borderTopColor:"var(--acc)",borderRadius:"50%",margin:"0 auto 16px"}}
            />
            <p style={{fontSize:".84rem",color:"var(--fg-dim)"}}>Analisando sua marca e o mês...</p>
          </div>
        )}

        {/* Sugestões geradas */}
        <AnimatePresence>
          {pauta && !loading && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{duration:.3}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                <div>
                  <div className="label" style={{marginBottom:4}}>PAUTA DE {pauta.mes.toUpperCase()}</div>
                  <p style={{fontSize:".8rem",color:"var(--fg-faint)"}}>Toque numa ideia pra gerar o conteúdo</p>
                </div>
                <button onClick={gerarSugestoes} disabled={loading} className="btn-ghost" style={{display:"flex",alignItems:"center",gap:5,padding:"8px 12px",fontSize:".75rem"}}>
                  <RefreshCw size={13}/> Gerar novas
                </button>
              </div>

              {/* Datas comemorativas */}
              {datasComem.length > 0 && (
                <div style={{marginBottom:24}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:12}}>
                    <Calendar size={14} style={{color:"#f59e0b"}}/>
                    <span className="label" style={{color:"#f59e0b",fontSize:".65rem"}}>DATAS DO MÊS</span>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {datasComem.map((s, i) => (
                      <SugestaoCard key={i} sugestao={s} onUsar={usarSugestao} delay={i * 0.06}/>
                    ))}
                  </div>
                </div>
              )}

              {/* Sugestões originais */}
              {originais.length > 0 && (
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:12}}>
                    <Lightbulb size={14} style={{color:"var(--acc)"}}/>
                    <span className="label" style={{color:"var(--acc)",fontSize:".65rem"}}>IDEIAS ORIGINAIS</span>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {originais.map((s, i) => (
                      <SugestaoCard key={i} sugestao={s} onUsar={usarSugestao} delay={(datasComem.length + i) * 0.06}/>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {erro && (
          <div style={{fontSize:".82rem",color:"#ef4444",background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:10,padding:"12px 14px",marginTop:16}}>
            {erro}
          </div>
        )}
      </main>
      <TabBar/>
    </div>
  )
}

function SugestaoCard({ sugestao, onUsar, delay }: { sugestao: Sugestao; onUsar: (s: Sugestao) => void; delay: number }) {
  return (
    <motion.button
      initial={{opacity:0,y:8}}
      animate={{opacity:1,y:0}}
      transition={{duration:.25,delay}}
      onClick={()=>onUsar(sugestao)}
      className="glass-content"
      style={{width:"100%",textAlign:"left",padding:"14px 16px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,background:"none",border:"1px solid var(--border)"}}>
      <div style={{flex:1}}>
        <div style={{fontWeight:600,fontSize:".88rem",marginBottom:4}}>{sugestao.titulo}</div>
        <div style={{fontSize:".76rem",color:"var(--fg-faint)",lineHeight:1.4,marginBottom:6}}>{sugestao.descricao}</div>
        <span style={{fontSize:".65rem",fontWeight:600,color:"var(--acc)",background:"var(--acc-dim)",border:"1px solid var(--acc-bd)",borderRadius:5,padding:"2px 7px"}}>
          {TIPO_LABEL[sugestao.tipo] || sugestao.tipo}
        </span>
      </div>
      <ArrowRight size={16} style={{color:"var(--fg-faint)",flexShrink:0}}/>
    </motion.button>
  )
}
