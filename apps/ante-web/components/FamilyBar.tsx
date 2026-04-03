export function FamilyBar() {
  return (
    <div className="bg-[#050810] border-b border-white/5 px-6 py-1.5 flex gap-6 items-center text-[11px] text-white/30">
      <a href="https://slyce-web-seven.vercel.app" className="hover:text-blue-400 transition font-mono">🔪 slyce</a>
      <span className="opacity-30">·</span>
      <a href="https://ante-web.vercel.app" className="hover:text-emerald-400 transition font-mono text-emerald-500/60">♠ ante</a>
      <span className="opacity-30">·</span>
      <span className="opacity-30 cursor-default font-mono">📦 drop</span>
    </div>
  );
}
