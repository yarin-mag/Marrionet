import type { AgentSnapshot } from "@marionette/shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { AgentDetailPanel } from "./AgentDetailPanel";

interface AgentDetailModalProps {
  agent: AgentSnapshot | null;
  open: boolean;
  onClose: () => void;
}

/**
 * AgentDetailModal - Modal wrapper for AgentDetailPanel
 * Uses enhanced Dialog component with better styling
 */
export function AgentDetailModal({ agent, open, onClose }: AgentDetailModalProps) {
  if (!agent) return null;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">Agent Details</DialogTitle>
        </DialogHeader>
        <AgentDetailPanel agent={agent} onClose={onClose} hideCloseButton={true} />
      </DialogContent>
    </Dialog>
  );
}
