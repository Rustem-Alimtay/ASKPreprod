import { Construction } from "lucide-react";

export function UnderDevelopmentBanner() {
  return (
    <div
      className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
      data-testid="banner-under-development"
    >
      <Construction className="h-5 w-5 shrink-0" />
      <div>
        <span className="font-semibold text-sm">Under Development</span>
        <span className="text-sm ml-1.5">— The data shown below is for preview purposes only.</span>
      </div>
    </div>
  );
}
