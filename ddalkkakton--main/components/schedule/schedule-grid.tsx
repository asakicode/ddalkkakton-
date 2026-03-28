"use client"

import { Fragment, useState, useCallback, useRef } from "react"
import { cn } from "@/lib/utils"

const DAYS = ["월", "화", "수", "목", "금", "토", "일"]
const HOURS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2)
  const minute = i % 2 === 0 ? "00" : "30"
  return `${hour.toString().padStart(2, "0")}:${minute}`
})

interface ScheduleGridProps {
  blockedSlots: Set<string>
  onSlotsChange: (slots: Set<string>) => void
}

export function ScheduleGrid({ blockedSlots, onSlotsChange }: ScheduleGridProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragMode, setDragMode] = useState<"block" | "unblock">("block")
  const gridRef = useRef<HTMLDivElement>(null)

  const getSlotKey = (day: string, time: string) => `${day}-${time}`

  const handleMouseDown = useCallback((day: string, time: string) => {
    const key = getSlotKey(day, time)
    setIsDragging(true)
    
    if (blockedSlots.has(key)) {
      setDragMode("unblock")
      const newSlots = new Set(blockedSlots)
      newSlots.delete(key)
      onSlotsChange(newSlots)
    } else {
      setDragMode("block")
      const newSlots = new Set(blockedSlots)
      newSlots.add(key)
      onSlotsChange(newSlots)
    }
  }, [blockedSlots, onSlotsChange])

  const handleMouseEnter = useCallback((day: string, time: string) => {
    if (!isDragging) return
    
    const key = getSlotKey(day, time)
    const newSlots = new Set(blockedSlots)
    
    if (dragMode === "block") {
      newSlots.add(key)
    } else {
      newSlots.delete(key)
    }
    
    onSlotsChange(newSlots)
  }, [isDragging, dragMode, blockedSlots, onSlotsChange])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  return (
    <div 
      ref={gridRef}
      className="select-none overflow-auto"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="min-w-[800px]">
        {/* Header */}
        <div className="grid grid-cols-8 gap-px bg-border sticky top-0 z-10">
          <div className="bg-card p-2 text-center text-sm font-mono text-muted-foreground">
            시간
          </div>
          {DAYS.map((day) => (
            <div
              key={day}
              className="bg-card p-2 text-center font-semibold text-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Time slots */}
        <div className="grid grid-cols-8 gap-px bg-border">
          {HOURS.map((time, timeIndex) => (
            <Fragment key={`row-${time}`}>
              <div
                key={`time-${time}`}
                className={cn(
                  "bg-card p-1 text-center text-xs font-mono text-muted-foreground",
                  timeIndex % 2 === 0 && "border-t border-border/50"
                )}
              >
                {timeIndex % 2 === 0 ? time : ""}
              </div>
              {DAYS.map((day) => {
                const key = getSlotKey(day, time)
                const isBlocked = blockedSlots.has(key)
                
                return (
                  <div
                    key={key}
                    className={cn(
                      "h-6 cursor-pointer transition-colors",
                      isBlocked
                        ? "bg-destructive/80 hover:bg-destructive"
                        : "bg-card hover:bg-secondary",
                      timeIndex % 2 === 0 && "border-t border-border/30"
                    )}
                    onMouseDown={() => handleMouseDown(day, time)}
                    onMouseEnter={() => handleMouseEnter(day, time)}
                  />
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
