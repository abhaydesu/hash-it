"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteEntry } from "@/app/actions/entry-actions";
import { Button } from "@/components/ui/button";

export function DeleteEntryButton({ entryId }: { entryId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleDelete = () => {
    startTransition(async () => {
      await deleteEntry(entryId);
      router.push("/problems");
    });
  };

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Delete this entry?</span>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={isPending}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleDelete}
          disabled={isPending}
          className="bg-red-600 text-white hover:bg-red-700"
        >
          {isPending ? "Deleting..." : "Delete"}
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setConfirming(true)}
      className="text-muted-foreground hover:text-red-600"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}
