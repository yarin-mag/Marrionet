import { useNavigate } from "react-router-dom";
import { Settings } from "lucide-react";
import { Button } from "../../../components/ui/button";

export function PreferencesDialog() {
  const navigate = useNavigate();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => navigate('/preferences')}
    >
      <Settings className="h-4 w-4" />
    </Button>
  );
}
