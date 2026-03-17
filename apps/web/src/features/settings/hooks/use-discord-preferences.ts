import { useEffect, useState } from "react";
import { fetchServerPreference, saveServerPreference } from "../../../lib/user-preferences";

interface DiscordPreferences {
  webhookUrl: string | null;
  notificationChannel: "browser" | "discord";
  saveError: string | null;
  testStatus: "idle" | "success" | "error";
  handleChange: (value: string) => Promise<void>;
  handleChannelChange: (channel: "browser" | "discord") => Promise<void>;
  testWebhook: () => Promise<void>;
}

export function useDiscordPreferences(): DiscordPreferences {
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [notificationChannel, setNotificationChannel] = useState<"browser" | "discord">("browser");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    fetchServerPreference("discordWebhookUrl", "").then(setWebhookUrl);
    fetchServerPreference<"browser" | "discord">("notificationChannel", "browser").then(setNotificationChannel);
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

  async function handleChannelChange(channel: "browser" | "discord") {
    setNotificationChannel(channel);
    try {
      await saveServerPreference("notificationChannel", channel);
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

  return { webhookUrl, notificationChannel, saveError, testStatus, handleChange, handleChannelChange, testWebhook };
}
