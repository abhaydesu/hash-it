import React from "react";
import { getUserSettings } from "@/app/actions/settings-actions";
import { readCustomFieldDefs } from "@/lib/custom-fields";
import { SettingsClient } from "@/components/settings-client";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Settings" };

// Loading UI lives in ./loading.tsx.
export default async function SettingsPage() {
  const settings = await getUserSettings();
  return (
    <SettingsClient
      initial={settings}
      initialCustomFields={readCustomFieldDefs(settings.customFields)}
    />
  );
}
