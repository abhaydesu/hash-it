import React from "react";
import { getUserSettings } from "@/app/actions/settings-actions";
import { readCustomFieldDefs } from "@/lib/custom-fields";
import { SettingsClient } from "@/components/settings-client";

export const dynamic = "force-dynamic";

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
