import { cn } from "@/lib/utils";

const LAYER_BADGE: Record<number, { label: string; classes: string }> = {
  1: {
    label: "Layer 1 · Smart Data Acquisition",
    classes: "border-teal-200 bg-teal-50 text-teal-700",
  },
  2: {
    label: "Layer 2 · Centralized AI Intelligence",
    classes: "border-blue-200 bg-blue-50 text-blue-700",
  },
  3: {
    label: "Layer 3 · Automated Engagement",
    classes: "border-green-200 bg-green-50 text-green-700",
  },
  4: {
    label: "Layer 4 · CRM Tracking",
    classes: "border-violet-200 bg-violet-50 text-violet-700",
  },
};

export function PageHeader({
  title,
  description,
  layer,
  actions,
}: {
  title: string;
  description?: string;
  layer?: 1 | 2 | 3 | 4;
  actions?: React.ReactNode;
}) {
  return (
    <div className="border-b border-zinc-200 bg-white px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {layer != null && (
            <div
              className={cn(
                "mb-2 inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
                LAYER_BADGE[layer].classes,
              )}
            >
              {LAYER_BADGE[layer].label}
            </div>
          )}
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="mt-1 max-w-3xl text-sm text-zinc-500">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function PageBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("px-6 py-6", className)}>{children}</div>;
}
