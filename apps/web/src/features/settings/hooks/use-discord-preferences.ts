import { useEffect, useState } from "react";
import { fetchServerPreference, saveServerPreference } from "../../../lib/user-preferences";

interface DiscordPreferences {
  webhookUrl: string | null;
  saveError: string | null;
  testStatus: "idle" | "success" | "error";
  handleChange: (value: string) => Promise<void>;
  testWebhook: () => Promise<void>;
}

export function useDiscordPreferences(): DiscordPreferences {
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    fetchServerPreference("discordWebhookUrl", "").then(setWebhookUrl);
  }, []);

  async function handleChange(value: string) {
    setWebhookUrl(value);
    setTestStatus("idle");
    try {
      await saveServerPreference("discordWebhookUrl", value);
      setSaveError(null);
    } catch {
      setSaveError("Failed to save. Check your connection.");
    }
  }

  async function testWebhook() {
    if (!webhookUrl) return;
    setTestStatus("idle");
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [{
            title: "✅ Marionette connected!",
            description: "Discord notifications are working. You'll be notified when sessions finish or agents crash.",
            color: 0x57f287,
            timestamp: new Date().toISOString(),
          }],
        }),
      });
      setTestStatus(res.ok ? "success" : "error");
    } catch {
      setTestStatus("error");
    }
  }

  return { webhookUrl, saveError, testStatus, handleChange, testWebhook };
}
