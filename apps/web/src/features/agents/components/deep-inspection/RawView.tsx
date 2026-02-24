import type { InspectData } from "./types";

interface RawViewProps {
  data: InspectData;
}

export function RawView({ data }: RawViewProps) {
  return (
    <pre className="text-xs bg-muted/50 p-4 rounded-lg overflow-x-auto border">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
