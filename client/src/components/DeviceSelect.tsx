import { Check } from "lucide-react";
import { cn } from "../utils/classname";

interface DeviceSelectProps {
  id: string;
  label: string;
  value: string;
  options: MediaDeviceInfo[];
  onChange: (deviceId: string) => void;
  empty?: string;
}

export function DeviceSelect({
  id,
  label,
  value,
  options,
  onChange,
  empty = "No devices",
}: DeviceSelectProps) {
  return (
    <fieldset className="text-left min-w-0 w-full">
      <legend className="text-xs font-medium text-muted-foreground mb-1.5">
        {label}
      </legend>
      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground px-3 py-2">{empty}</p>
      ) : (
        <div
          id={id}
          role="radiogroup"
          aria-label={label}
          className="flex flex-col gap-1.5 max-h-36 overflow-y-auto overflow-x-hidden min-w-0"
        >
          {options.map((device, i) => {
            const selected = device.deviceId === value;
            return (
              <button
                key={device.deviceId || i}
                type="button"
                role="radio"
                aria-checked={selected}
                title={device.label || `${label} ${i + 1}`}
                onClick={() => onChange(device.deviceId)}
                className={cn(
                  "flex items-center justify-between gap-2 w-full min-w-0 max-w-full text-left px-3 py-2.5 rounded-2xl text-sm transition-all border backdrop-blur-md overflow-hidden",
                  selected
                    ? "bg-primary/25 border-primary/70 text-foreground shadow-sm"
                    : "bg-white/50 border-transparent hover:bg-white/80 text-foreground/80",
                )}
              >
                <span className="min-w-0 flex-1 truncate">
                  {device.label || `${label} ${i + 1}`}
                </span>
                {selected && (
                  <Check className="size-4 shrink-0 text-foreground" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
