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
    <label className="block text-left" htmlFor={id}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={options.length === 0}
        className={cn(
          "mt-1 w-full px-3 py-2.5 text-sm rounded-xl border-2 border-border bg-card outline-none focus:border-primary",
        )}
      >
        {options.length === 0 && <option value="">{empty}</option>}
        {options.map((device, i) => (
          <option key={device.deviceId || i} value={device.deviceId}>
            {device.label || `${label} ${i + 1}`}
          </option>
        ))}
      </select>
    </label>
  );
}
