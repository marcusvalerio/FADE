"use client"
import { useRouter, usePathname } from "next/navigation"
import { LayoutDashboard, PenSquare, Calendar, Store, Vault, Settings } from "lucide-react"

const TABS = [
  { href: "/dashboard",       icon: LayoutDashboard, label: "Início" },
  { href: "/conteudos",       icon: PenSquare,        label: "Conteúdos" },
  { href: "/calendario",      icon: Calendar,         label: "Calendário" },
  { href: "/minha-barbearia", icon: Store,            label: "Barbearia" },
  { href: "/cofre",           icon: Vault,            label: "Cofre" },
  { href: "/configuracoes",   icon: Settings,         label: "Config" },
]

export function TabBar() {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <nav className="tab-bar" style={{ gridTemplateColumns: `repeat(${TABS.length}, 1fr)` }}>
      {TABS.map(({ href, icon: Icon, label }) => {
        const active = pathname === href || (href === "/conteudos" && pathname.startsWith("/conteudos"))
        return (
          <button key={href} onClick={() => router.push(href)} className="tab-item">
            <Icon
              size={21}
              strokeWidth={1.6}
              style={{
                color: active ? "#4F7DFF" : "#6B7280",
                opacity: active ? 1 : 0.5,
                filter: active ? "drop-shadow(0 0 8px rgba(79,125,255,.5))" : "none",
                transition: "color 200ms, opacity 200ms, filter 200ms",
              }}
            />
            <span style={{ fontSize: ".58rem", fontWeight: active ? 600 : 400, color: active ? "#4F7DFF" : "#6B7280", opacity: active ? 1 : 0.5, transition: "color 200ms, opacity 200ms" }}>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
