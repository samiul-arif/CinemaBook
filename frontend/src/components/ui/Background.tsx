export function Background() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Graph-paper background texture */}
      <div className="absolute inset-0 graph-grid opacity-60" />

      {/* Ambient Blob 1 (Terracotta / Peach Primary Glow) */}
      <div
        className="rx-blob-1 absolute -top-40 -left-20 w-[550px] h-[550px] rounded-full blur-[120px] opacity-40 dark:opacity-30 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgb(var(--color-primary)) 0%, transparent 70%)',
        }}
      />

      {/* Ambient Blob 2 (Warm Surface Glow Bottom-Right) */}
      <div
        className="rx-blob-2 absolute top-1/2 -right-40 w-[600px] h-[600px] rounded-full blur-[140px] opacity-35 dark:opacity-25 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgb(var(--color-primary-dark)) 0%, transparent 70%)',
        }}
      />

      {/* Ambient Blob 3 (Center Accent Warmth) */}
      <div
        className="rx-blob-3 absolute -bottom-40 left-1/3 w-[500px] h-[500px] rounded-full blur-[130px] opacity-25 dark:opacity-20 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgb(var(--color-primary)) 0%, transparent 70%)',
        }}
      />
    </div>
  );
}
