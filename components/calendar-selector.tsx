"use client";

import { useTranslations } from "next-intl";
import { CalendarWithCount } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Settings } from "lucide-react";

interface CalendarSelectorProps {
  calendars: CalendarWithCount[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
  onManagePassword?: () => void;
}

export function CalendarSelector({
  calendars,
  selectedId,
  onSelect,
  onCreateNew,
  onManagePassword,
}: CalendarSelectorProps) {
  const t = useTranslations();

  return (
    <div className="flex gap-2 items-center">
      <Select value={selectedId} onValueChange={onSelect}>
        <SelectTrigger className="flex-1 h-9 sm:h-10 text-sm">
          <SelectValue placeholder={t("calendar.title")} />
        </SelectTrigger>
        <SelectContent>
          {calendars.map((calendar) => (
            <SelectItem key={calendar.id} value={calendar.id}>
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: calendar.color }}
                />
                {calendar.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {onManagePassword && selectedId && (
        <Button
          onClick={onManagePassword}
          size="icon"
          variant="outline"
          className="h-9 w-9 sm:h-10 sm:w-10"
          title={t("calendar.managePassword")}
        >
          <Settings className="h-4 w-4" />
        </Button>
      )}
      <Button
        onClick={onCreateNew}
        size="icon"
        variant="outline"
        className="h-9 w-9 sm:h-10 sm:w-10"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
