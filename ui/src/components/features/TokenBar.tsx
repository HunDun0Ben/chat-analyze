import { Progress } from '../ui/Progress';

interface TokenBarProps {
  label: string;
  value: number;
  max: number;
  color?: string;
}

export function TokenBar({ label, value, max, color }: TokenBarProps) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-slate-500">{label}</span>
        <span className="font-mono text-slate-400">
          {value.toLocaleString()}
        </span>
      </div>
      <Progress value={value} max={max} indicatorClassName={color} />
    </div>
  );
}
