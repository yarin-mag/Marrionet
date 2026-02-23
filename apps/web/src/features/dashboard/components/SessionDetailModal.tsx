import { Dialog, DialogContent } from "../../../components/ui/dialog";
import type { AgentSession } from "../../../services/calendar.service";
import { SessionDetail } from "./SessionDetail";

interface SessionDetailModalProps {
  session: AgentSession | null;
  open: boolean;
  onClose: () => void;
}

export function SessionDetailModal({ session, open, onClose }: SessionDetailModalProps) {
  if (!session) return null;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <SessionDetail session={session} />
      </DialogContent>
    </Dialog>
  );
}
