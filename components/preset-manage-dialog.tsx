import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { ShiftPreset } from "@/lib/db/schema";

interface PresetManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presets: ShiftPreset[];
  onCreateNew: () => void;
  onEdit: (preset: ShiftPreset) => void;
  onDelete: (presetId: string) => void;
}

export function PresetManageDialog({
  open,
  onOpenChange,
  presets,
  onCreateNew,
  onEdit,
  onDelete,
}: PresetManageDialogProps) {
  const t = useTranslations();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] flex flex-col p-0 gap-0 border border-border/50 bg-gradient-to-b from-background via-background to-muted/30 backdrop-blur-xl shadow-2xl">
        <DialogHeader className="border-b border-border/50 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 pb-5 space-y-1.5">
          <DialogTitle className="text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            {t("preset.manage")}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t("preset.manageDescription", {
              default: "Edit or delete your shift presets",
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 overflow-y-auto flex-1 p-6">
          <Button
            onClick={onCreateNew}
            className="w-full h-11 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-lg shadow-primary/25"
            variant="default"
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("preset.createNew")}
          </Button>
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/30 transition-all"
              style={{ borderLeftColor: preset.color, borderLeftWidth: 4 }}
            >
              <div className="flex-1">
                <div className="font-semibold flex items-center gap-2">
                  <div
                    className="w-1 h-4 rounded-full"
                    style={{ backgroundColor: preset.color }}
                  ></div>
                  {preset.title}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {preset.isAllDay ? (
                    <span>{t("shift.allDay")}</span>
                  ) : (
                    <>
                      {preset.startTime} - {preset.endTime}
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(preset)}
                  className="h-9"
                >
                  {t("common.edit")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(preset.id)}
                  className="h-9 w-9 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
