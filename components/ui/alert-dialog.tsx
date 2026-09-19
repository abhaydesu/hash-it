"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";

interface AlertDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description: string;
  buttonText?: string;
}

export function AlertDialog({
  isOpen,
  onOpenChange,
  title = "Something needs your attention",
  description,
  buttonText = "OK",
}: AlertDialogProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onOpenChange]);

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="ui-overlay fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div
        className="ui-modal w-[90vw] max-w-sm border border-border bg-background p-5 shadow-lg"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <h2 id="alert-dialog-title" className="text-base font-semibold text-foreground">
          {title}
        </h2>
        <p id="alert-dialog-description" className="mt-2 text-sm text-muted-foreground">
          {description}
        </p>
        <div className="mt-5 flex justify-end">
          <Button variant="primary" size="sm" onClick={() => onOpenChange(false)}>
            {buttonText}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Drop-in replacement for `alert(message)` that renders `<AlertDialog />` instead of a native dialog. */
export function useAlertDialog() {
  const [state, setState] = React.useState<{ isOpen: boolean; title?: string; description: string }>({
    isOpen: false,
    description: "",
  });

  const showAlert = React.useCallback((description: string, title?: string) => {
    setState({ isOpen: true, description, title });
  }, []);

  const dialog = (
    <AlertDialog
      isOpen={state.isOpen}
      onOpenChange={(open) => setState((s) => ({ ...s, isOpen: open }))}
      title={state.title}
      description={state.description}
    />
  );

  return { showAlert, alertDialog: dialog };
}
