import { useCallback, useState } from "react";
import { tokenAlertStorage } from "../lib/token-alerts";
import type { TokenAlert } from "../lib/token-alerts";

export function useTokenAlerts(agentId: string) {
  const [alerts, setAlerts] = useState<TokenAlert[]>(() =>
    tokenAlertStorage.getAlerts(agentId)
  );

  const addAlert = useCallback(
    (threshold: number) => {
      const alert = tokenAlertStorage.addAlert(agentId, threshold);
      setAlerts((prev) => [...prev, alert]);
    },
    [agentId]
  );

  const updateAlert = useCallback((id: string, threshold: number) => {
    const updated = tokenAlertStorage.updateAlert(id, threshold);
    setAlerts((prev) => prev.map((a) => (a.id === id ? updated : a)));
  }, []);

  const removeAlert = useCallback((id: string) => {
    tokenAlertStorage.removeAlert(id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { alerts, addAlert, updateAlert, removeAlert };
}
