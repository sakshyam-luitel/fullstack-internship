import { BookOpen } from "lucide-react";

interface BrandMarkProps {
  compact?: boolean;
}

// Keep the ARMS identity consistent across authentication and dashboard surfaces.
function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-11 items-center justify-center rounded-xl bg-blue-500 text-white shadow-lg shadow-blue-950/20">
        <BookOpen size={22} aria-hidden="true" />
      </span>
      {!compact && <span className="font-serif text-lg text-white">ARMS</span>}
    </div>
  );
}

export default BrandMark;
