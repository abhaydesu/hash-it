"use client";

import * as React from "react";
import { format, subDays, startOfWeek, addDays, getDay } from "date-fns";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface HeatmapProps {
  data: Record<string, number>;
  className?: string;
  selectedYear?: string;
}

export function Heatmap({ data, className, selectedYear = "last365" }: HeatmapProps) {
  const { startDate, endDate } = React.useMemo(() => {
    if (selectedYear === "last365") {
      const end = new Date();
      const start = startOfWeek(subDays(end, 365));
      return { startDate: start, endDate: end };
    } else {
      const y = parseInt(selectedYear, 10);
      const end = new Date(y, 11, 31);
      const start = startOfWeek(new Date(y, 0, 1));
      return { startDate: start, endDate: end };
    }
  }, [selectedYear]);

  const days: Date[] = [];
  let current = startDate;
  
  while (current <= endDate) {
    days.push(current);
    current = addDays(current, 1);
  }

  // Create columns of weeks
  const columns: Date[][] = [];
  let currentWeek: Date[] = [];
  
  days.forEach((day) => {
    currentWeek.push(day);
    if (getDay(day) === 6) {
      columns.push(currentWeek);
      currentWeek = [];
    }
  });
  if (currentWeek.length > 0) columns.push(currentWeek);

  const getLevel = (count: number) => {
    if (count === 0) return 0;
    if (count <= 2) return 1;
    if (count <= 4) return 2;
    if (count <= 6) return 3;
    return 4;
  };

  const monthLabels = columns.map((col, i) => {
    const firstDay = col[0];
    if (firstDay.getDate() <= 7) {
      return { index: i, label: format(firstDay, "MMM") };
    }
    return null;
  }).filter(Boolean) as { index: number; label: string }[];

  return (
    <TooltipProvider delayDuration={0}>
      <div className={cn("flex flex-col w-full", className)}>
        <div className="w-full overflow-x-auto scrollbar-none pb-2">
          <div className="w-full min-w-[700px] pr-4">
            <div className="flex text-[10px] text-muted-foreground mb-2 h-4">
              <div className="w-8 shrink-0" /> {/* Spacer for day labels */}
              <div className="flex flex-1 relative h-full">
                {monthLabels.map((m) => (
                  <span
                    key={`${m.index}-${m.label}`}
                    className="absolute"
                    style={{ left: `${(m.index / columns.length) * 100}%` }}
                  >
                    {m.label}
                  </span>
                ))}
              </div>
            </div>
            
            <div className="flex w-full justify-between gap-1">
              <div className="flex flex-col justify-between text-[10px] text-muted-foreground leading-[11px] w-8 shrink-0 py-1">
                <span className="invisible">Sun</span>
                <span>Mon</span>
                <span className="invisible">Tue</span>
                <span>Wed</span>
                <span className="invisible">Thu</span>
                <span>Fri</span>
                <span className="invisible">Sat</span>
              </div>
              
              {columns.map((col, i) => (
                <div key={i} className="flex flex-col gap-[3px]">
                  {col.map((day) => {
                    const dateStr = format(day, "yyyy-MM-dd");
                    const isFuture = day > new Date();
                    const count = !isFuture ? (data[dateStr] || 0) : 0;
                    const level = getLevel(count);
                    
                    return (
                      <Tooltip key={dateStr}>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              "w-[11px] h-[11px] rounded-[2px] transition-colors",
                              isFuture && "opacity-20",
                              level === 0 && "bg-muted/40",
                              level === 1 && "bg-orange-200 dark:bg-orange-950",
                              level === 2 && "bg-orange-400 dark:bg-orange-800",
                              level === 3 && "bg-orange-500 dark:bg-orange-600",
                              level === 4 && "bg-orange-600 dark:bg-orange-500",
                            )}
                            style={
                              i === 0 && getDay(day) !== 0 && col[0] === day
                                ? { marginTop: `${getDay(day) * 14}px` }
                                : {}
                            }
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top" sideOffset={8}>
                          <p>
                            {count} {count === 1 ? "problem" : "problems"} on {format(day, "MMM d, yyyy")}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
