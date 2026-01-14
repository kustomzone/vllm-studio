import { GPU } from '@/lib/types';
import { cn } from '@/lib/cn';

interface GPUTableProps {
  gpus: GPU[];
  className?: string;
}

export function GPUTable({ gpus, className }: GPUTableProps) {
  const toGB = (value: number): number => {
    if (value > 1e10) return value / (1024 * 1024 * 1024);
    if (value > 1e8) return value / (1024 * 1024 * 1024);
    if (value > 1000) return value / 1024;
    return value;
  };

  const totalMem = gpus.reduce((sum, g) => sum + toGB(g.memory_used_mb ?? g.memory_used ?? 0), 0);
  const totalMemMax = gpus.reduce((sum, g) => sum + toGB(g.memory_total_mb ?? g.memory_total ?? 0), 0);
  const totalPower = gpus.reduce((sum, g) => sum + (g.power_draw || 0), 0);

  return (
    <div className={cn('bg-[var(--card)] rounded-lg overflow-hidden', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[var(--muted-foreground)] text-xs border-b border-[var(--border)]">
            <th className="text-left py-3 px-4 font-normal">#</th>
            <th className="text-left py-3 px-4 font-normal">Util</th>
            <th className="text-left py-3 px-4 font-normal">Memory</th>
            <th className="text-left py-3 px-4 font-normal">Temp</th>
            <th className="text-left py-3 px-4 font-normal">Power</th>
          </tr>
        </thead>
        <tbody>
          {gpus.map((gpu, i) => {
            const memUsed = toGB(gpu.memory_used_mb ?? gpu.memory_used ?? 0);
            const memTotal = toGB(gpu.memory_total_mb ?? gpu.memory_total ?? 1);
            const memPct = (memUsed / memTotal) * 100;
            const temp = gpu.temp_c ?? gpu.temperature ?? 0;
            const util = gpu.utilization_pct ?? gpu.utilization ?? 0;
            return (
              <tr key={gpu.id ?? gpu.index} className={i > 0 ? 'border-t border-[var(--border)]/50' : ''}>
                <td className="py-3 px-4 text-[var(--muted-foreground)]">{gpu.id ?? gpu.index}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-1 bg-[var(--border)] rounded-full overflow-hidden">
                      <div className="h-full bg-[var(--link)] rounded-full" style={{ width: `${util}%` }} />
                    </div>
                    <span className="text-[var(--muted-foreground)] text-xs w-8">{util}%</span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-20 h-1 bg-[var(--border)] rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', memPct > 90 ? 'bg-[var(--error)]' : memPct > 70 ? 'bg-[var(--warning)]' : 'bg-[var(--success)]')}
                        style={{ width: `${memPct}%` }}
                      />
                    </div>
                    <span className="text-[var(--muted-foreground)] text-xs">{memUsed.toFixed(1)}/{memTotal.toFixed(0)}G</span>
                  </div>
                </td>
                <td className={cn('py-3 px-4 text-sm', temp > 80 ? 'text-[var(--error)]' : temp > 65 ? 'text-[var(--warning)]' : 'text-[var(--success)]')}>
                  {temp}°
                </td>
                <td className="py-3 px-4 text-[var(--muted-foreground)] text-sm">
                  {gpu.power_draw ? `${Math.round(gpu.power_draw)}W` : '--'}
                </td>
              </tr>
            );
          })}
        </tbody>
        {gpus.length > 0 && (
          <tfoot>
            <tr className="border-t border-[var(--border)] text-xs text-[var(--muted-foreground)]">
              <td className="py-2.5 px-4 font-medium">Total</td>
              <td className="py-2.5 px-4">
                {Math.round(gpus.reduce((sum, g) => sum + (g.utilization_pct ?? g.utilization ?? 0), 0) / gpus.length)}% avg
              </td>
              <td className="py-2.5 px-4">
                {totalMem.toFixed(1)}/{totalMemMax.toFixed(0)}G
              </td>
              <td className="py-2.5 px-4">
                {Math.round(gpus.reduce((sum, g) => sum + (g.temp_c ?? g.temperature ?? 0), 0) / gpus.length)}° avg
              </td>
              <td className="py-2.5 px-4 font-medium text-[var(--foreground)]">
                {Math.round(totalPower)}W
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
