"use client"

import { AlertTriangle, Wallet } from "lucide-react"

interface DepositDisplayProps {
  amount: number
}

export function DepositDisplay({ amount }: DepositDisplayProps) {
  const formattedAmount = amount.toLocaleString("ko-KR")
  
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/20">
          <Wallet className="h-6 w-6 text-warning" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">내 현재 예치금</p>
          <p className="text-2xl font-bold text-warning">{formattedAmount}P</p>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <span className="text-sm text-destructive">불참 시 차감</span>
      </div>
    </div>
  )
}
