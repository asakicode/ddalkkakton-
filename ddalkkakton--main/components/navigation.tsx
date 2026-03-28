"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Calendar, Users, Target, Coins } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", label: "내 시간표", icon: Calendar },
  { href: "/room", label: "방 만들기", icon: Users },
  { href: "/roulette", label: "운명의 룰렛", icon: Target },
  { href: "/shop", label: "포인트샵", icon: Coins },
]

export function Navigation() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm md:relative md:border-b md:border-t-0">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-around md:justify-start md:gap-1 md:px-4">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-4 py-3 text-xs transition-colors md:flex-row md:gap-2 md:text-sm",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
                <span className={cn(isActive && "font-semibold")}>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
