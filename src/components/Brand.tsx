export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? 'brand brand-compact' : 'brand'} aria-label="MEJA52">
      MEJA<sup>52</sup>
    </span>
  );
}
