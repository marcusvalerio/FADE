"use client"
import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Scissors, Sparkles, Copy, LogOut, Check, Trash2 } from "lucide-react"
import { supabaseBrowser } from "@/lib/supabase-client"
import type { Marca, Conteudo, Assinatura, Plano } from "@/lib/types"
import { TabBar } from "@/components/tab-bar"
import { CardSkeleton } from "@/components/skeleton"

const TIPOS = [
  { id: "post", label: "Post" },
  { id: "story", label: "Story" },
  { id: "reel_script", label: "Roteiro Reels" },
  { id: "legenda", label: "Legenda" },
  { id: "promocao", label: "Promoção" },
]
const REDES = ["instagram", "tiktok", "facebook", "whatsapp"]

export default function Dashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [marca, setMarca] = useState<Marca | null>(null)
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null)
  const [plano, setPlano] = useState<Plano | null>(null)
  const [conteudos, setConteudos] = useState<Conteudo[]>([])

  const [dataAgendada, setDataAgendada] = useState("")
  const searchParams = useSearchParams()
  const [tipo, setTipo] = useState(searchParams.get("tipo") || "post")
  const [rede, setRede] = useState("instagram")
  const [tema, setTema] = useState(searchParams.get("tema") || "")
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState("")
  const [aviso, setAviso] = useState("")
  const [copiadoId, setCopiadoId] = useState<string | null>(null)
  const [apagandoId, setApagandoId] = useState<string | null>(null)
  const [confirmandoApagar, setConfirmandoApagar] = useState<string | null>(null)

  useEffect(() => { init() }, [])

  const init = async () => {
    const supabase = supabaseBrowser()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/onboarding"); return }

    // A marca já é criada no auth/callback a partir do onboarding pendente.
    const { data: marcaAtual } = await supabase.from("marcas").select("*").eq("user_id", user.id).maybeSingle()
    setMarca(marcaAtual)

    const { data: assin } = await supabase.from("assinaturas").select("*").eq("user_id", user.id).maybeSingle()
    setAssinatura(assin)

    if (assin) {
      const { data: pl } = await supabase.from("planos").select("*").eq("id", assin.plano_id).single()
      setPlano(pl)
    }

    if (marcaAtual) {
      const { data: cs } = await supabase.from("conteudos").select("*").eq("marca_id", marcaAtual.id).order("created_at", { ascending: false }).limit(20)
      setConteudos(cs || [])
    }

    setLoading(false)
  }

  const gerar = async () => {
    if (!marca) return
    setGerando(true)
    setErro("")
    setAviso("")
    try {
      const res = await fetch("/api/gerar", {
        method: "POST",
        body: JSON.stringify({ marca_id: marca.id, tipo, rede, tema, data_agendada: dataAgendada || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErro(data.error || "Não conseguimos gerar agora. Tenta de novo em alguns segundos.")
        return
      }
      setConteudos(prev => [data.conteudo, ...prev])
      setTema("")
      setDataAgendada("")
      if (data.aviso) setAviso(data.aviso)
      if (assinatura) setAssinatura({ ...assinatura, conteudos_usados_mes: assinatura.conteudos_usados_mes + 1 })
    } catch {
      setErro("Sem conexão com o servidor. Verifica sua internet e tenta de novo.")
    } finally {
      setGerando(false)
    }
  }

  const copiar = (c: Conteudo) => {
    const texto = `${c.conteudo}\n\n${c.hashtags.map(h => `#${h.replace(/^#/, "")}`).join(" ")}`
    navigator.clipboard.writeText(texto)
    setCopiadoId(c.id)
    setTimeout(() => setCopiadoId(null), 1800)
  }

  const apagar = async (id: string) => {
    setApagandoId(id)
    const res = await fetch(`/api/conteudo/${id}`, { method: "DELETE" })
    if (res.ok) {
      setConteudos(prev => prev.filter(c => c.id !== id))
    }
    setApagandoId(null)
    setConfirmandoApagar(null)
  }

  const sair = async () => {
    const supabase = supabaseBrowser()
    await supabase.auth.signOut()
    router.push("/")
  }

  if (loading) {
    return (
      <div style={{minHeight:"100vh"}}>
        <header className="glass-nav" style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",position:"sticky",top:0,zIndex:10}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <Scissors size={16} style={{color:"var(--acc)"}} />
            <span className="font-brand" style={{fontSize:"1rem"}}>FADE Conteúdo</span>
          </div>
        </header>
        <main style={{maxWidth:680,margin:"0 auto",padding:"28px 20px 100px"}}>
          <CardSkeleton/>
        </main>
      </div>
    )
  }

  const usados = assinatura?.conteudos_usados_mes || 0
  const limite = plano?.limite_conteudos_mes || 5
  const pct = Math.min(100, Math.round((usados / limite) * 100))

  const h = new Date().getHours()
  const periodo = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"
  const primeiroNome = marca?.admin_nome?.trim().split(" ")[0]

  return (
    <div style={{minHeight:"100vh"}}>
      <header className="glass-nav" style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <Scissors size={16} style={{color:"var(--acc)"}} />
          <span className="font-brand" style={{fontSize:"1rem"}}>FADE Conteúdo</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <button onClick={sair} style={{background:"none",border:"none",color:"var(--fg-faint)",cursor:"pointer"}}><LogOut size={16}/></button>
        </div>
      </header>

      <main style={{maxWidth:680,margin:"0 auto",padding:"28px 20px 100px"}}>

        <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:.35}} style={{marginBottom:22}}>
          <h1 className="font-display" style={{fontSize:"1.5rem",fontWeight:700,letterSpacing:"-.01em"}}>
            {periodo}{primeiroNome ? `, ${primeiroNome}` : ""}!
          </h1>
          <p style={{fontSize:".84rem",color:"var(--fg-dim)",marginTop:4}}>Aqui está toda a evolução da {marca?.nome || "sua marca"}.</p>
        </motion.div>

        {/* Status do plano */}
        <div className="glass" style={{padding:"16px 18px",marginBottom:24,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div className="label" style={{marginBottom:5}}>PLANO {plano?.nome?.toUpperCase() || "FREE"}</div>
            <div style={{fontSize:".82rem",color:"var(--fg-dim)"}}>{usados} de {limite} conteúdos usados este mês</div>
          </div>
          <div style={{width:50,height:50,position:"relative"}}>
            <svg width="50" height="50" viewBox="0 0 50 50" style={{transform:"rotate(-90deg)"}}>
              <circle cx="25" cy="25" r="21" fill="none" stroke="var(--border)" strokeWidth="4"/>
              <circle cx="25" cy="25" r="21" fill="none" stroke={pct>=90?"#ef4444":"var(--acc)"} strokeWidth="4" strokeLinecap="round"
                strokeDasharray={`${2*Math.PI*21}`} strokeDashoffset={`${2*Math.PI*21*(1-pct/100)}`}/>
            </svg>
            <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:".68rem",fontWeight:600}}>{pct}%</div>
          </div>
        </div>

        {/* Gerador */}
        <div className="card" style={{padding:"22px",marginBottom:28}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:18}}>
            <Sparkles size={15} style={{color:"var(--acc)"}}/>
            <span className="font-display" style={{fontSize:"1.05rem",fontWeight:700}}>Gerar conteúdo</span>
          </div>

          <div className="label" style={{marginBottom:8}}>TIPO</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:16}}>
            {TIPOS.map(t=>(
              <button key={t.id} onClick={()=>setTipo(t.id)} className={`chip ${tipo===t.id?"chip-on":""}`}>{t.label}</button>
            ))}
          </div>

          <div className="label" style={{marginBottom:8}}>REDE</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:16}}>
            {REDES.map(r=>(
              <button key={r} onClick={()=>setRede(r)} className={`chip ${rede===r?"chip-on":""}`} style={{textTransform:"capitalize"}}>{r}</button>
            ))}
          </div>

          <div className="label" style={{marginBottom:8}}>TEMA (OPCIONAL)</div>
          <input className="inp" placeholder="ex: promoção de terça, novo serviço, dica de cuidado" value={tema} onChange={e=>setTema(e.target.value)} style={{marginBottom:16}}/>

          <div className="label" style={{marginBottom:8}}>AGENDAR PARA (OPCIONAL)</div>
          <input type="date" className="inp" value={dataAgendada} onChange={e=>setDataAgendada(e.target.value)} style={{marginBottom:16,colorScheme:"dark"}}/>

          {erro && (
            <div style={{display:"flex",alignItems:"flex-start",gap:8,fontSize:".8rem",color:"#ef4444",marginBottom:14,background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,padding:"10px 12px"}}>
              {erro}
            </div>
          )}
          {aviso && (
            <div style={{display:"flex",alignItems:"flex-start",gap:8,fontSize:".8rem",color:"#f59e0b",marginBottom:14,background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:8,padding:"10px 12px"}}>
              {aviso}
            </div>
          )}

          <button onClick={gerar} disabled={gerando || usados >= limite} className="btn-primary" style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            {gerando ? (
              <>
                <motion.div animate={{rotate:360}} transition={{duration:0.8,repeat:Infinity,ease:"linear"}} style={{width:13,height:13,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",borderRadius:"50%"}}/>
                Gerando, pode levar alguns segundos...
              </>
            ) : usados >= limite ? "Limite do plano atingido" : <>Gerar conteúdo <Sparkles size={14}/></>}
          </button>
        </div>

        {/* Lista de conteúdos */}
        <div className="label" style={{marginBottom:14}}>CONTEÚDOS RECENTES</div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <AnimatePresence>
            {conteudos.map(c=>(
              <motion.div key={c.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,height:0}} className="glass glass-hover" style={{padding:"16px 18px",overflow:"hidden"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:".88rem",marginBottom:3}}>{c.titulo}</div>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <span className="label" style={{fontSize:".62rem"}}>{TIPOS.find(t=>t.id===c.tipo)?.label}</span>
                      <span style={{color:"var(--fg-faint)"}}>·</span>
                      <span className="label" style={{fontSize:".62rem",textTransform:"capitalize"}}>{c.rede}</span>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0}}>
                    <button onClick={()=>copiar(c)} className="btn-ghost" style={{padding:"6px 10px",display:"flex",alignItems:"center",gap:5}}>
                      {copiadoId===c.id ? <><Check size={12}/> Copiado</> : <><Copy size={12}/> Copiar</>}
                    </button>
                    {confirmandoApagar === c.id ? (
                      <button onClick={()=>apagar(c.id)} disabled={apagandoId===c.id} className="btn-ghost" style={{padding:"6px 10px",borderColor:"rgba(239,68,68,0.4)",color:"#ef4444"}}>
                        {apagandoId===c.id ? "..." : "Confirmar"}
                      </button>
                    ) : (
                      <button onClick={()=>setConfirmandoApagar(c.id)} className="btn-ghost" style={{padding:"6px 8px"}}>
                        <Trash2 size={12}/>
                      </button>
                    )}
                  </div>
                </div>
                <p style={{fontSize:".84rem",color:"var(--fg-dim)",lineHeight:1.55,whiteSpace:"pre-wrap"}}>{c.conteudo}</p>
                {c.hashtags?.length > 0 && (
                  <div style={{marginTop:10,fontSize:".78rem",color:"var(--acc)"}}>{c.hashtags.map(h=>`#${h.replace(/^#/,"")}`).join(" ")}</div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {conteudos.length===0 && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} className="card" style={{textAlign:"center",padding:"36px 24px"}}>
              <Sparkles size={22} style={{color:"var(--acc)",marginBottom:12}}/>
              <div style={{fontWeight:600,fontSize:".9rem",marginBottom:6}}>Sua primeira publicação está a um clique</div>
              <p style={{fontSize:".8rem",color:"var(--fg-faint)",lineHeight:1.5,maxWidth:280,margin:"0 auto"}}>
                Escolhe um tipo de conteúdo acima e toca em &quot;Gerar conteúdo&quot; — em segundos você tem um post pronto, no tom da sua marca.
              </p>
            </motion.div>
          )}
        </div>
      </main>
      <TabBar/>
    </div>
  )
}
