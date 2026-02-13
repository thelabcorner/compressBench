import { Globe, Code2, Cpu } from 'lucide-react';
import { cn } from '@/lib/cn';
import { getProviderBadgeClass } from '@/constants';

export function ProviderIcon({ provider }: { provider: string }) {
  if (provider === 'native') return <Globe className="w-2.5 h-2.5" />;
  if (provider === 'brotli-wasm' || provider === 'zstd-codec') return <Cpu className="w-2.5 h-2.5" />;
  return <Code2 className="w-2.5 h-2.5" />;
}

export function ProviderBadge({ provider, label, isDark }: { provider: string; label: string; isDark: boolean }) {
  return (
    <span className={cn(
      "text-[10px] px-1.5 py-0.5 rounded-full border font-medium inline-flex items-center gap-0.5",
      getProviderBadgeClass(provider, isDark)
    )}>
      <ProviderIcon provider={provider} />
      {label}
    </span>
  );
}
