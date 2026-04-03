import Link from "next/link";

const PRODUCTS = [
  {
    emoji: "🔪",
    name: "slyce",
    tagline: "Trustless split payments",
    description: "Create permissionless payment splits. Anyone deposits, every recipient gets their cut — automatically, on-chain.",
    url: "https://slyce-web-seven.vercel.app",
    accent: "text-blue-400",
    border: "hover:border-blue-500/40",
    glow: "hover:bg-blue-500/5",
    badge: "bg-blue-500/10 text-blue-400",
    cta: "Open slyce →",
  },
  {
    emoji: "♠",
    name: "ante",
    tagline: "Group contribution vaults",
    description: "Everyone puts their chips in. Funds only release when the pot's right — or raise a fundraise anyone can back.",
    url: "https://ante-web.vercel.app",
    accent: "text-emerald-400",
    border: "hover:border-emerald-500/40",
    glow: "hover:bg-emerald-500/5",
    badge: "bg-emerald-500/10 text-emerald-400",
    cta: "Open ante →",
  },
  {
    emoji: "📦",
    name: "drop",
    tagline: "Airdrop infrastructure",
    description: "Upload a wallet list, get a fee estimate, confirm — and the program distributes tokens to every recipient on-chain.",
    url: null,
    accent: "text-amber-400",
    border: "hover:border-amber-500/40",
    glow: "hover:bg-amber-500/5",
    badge: "bg-amber-500/10 text-amber-400",
    cta: "Coming soon",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#080c14] text-white">

      {/* Hero */}
      <div className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center space-y-6">
        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-xs text-white/40 font-mono tracking-wide">
          built on solana · devnet
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight">
          <span className="text-white">slip</span><span className="text-violet-400">deck</span>
        </h1>
        <p className="text-lg text-white/50 max-w-xl mx-auto leading-relaxed">
          A suite of trustless payment protocols. Split, pool, and distribute value on-chain — no intermediaries, no permissions.
        </p>
        <div className="flex items-center justify-center gap-2 text-xs text-white/20 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
          live on solana devnet
        </div>
      </div>

      {/* Product cards */}
      <div className="max-w-4xl mx-auto px-6 pb-24">
        <div className="grid gap-4 sm:grid-cols-3">
          {PRODUCTS.map((p) => (
            <div key={p.name}
              className={`bg-[#0e1420] border border-white/8 ${p.border} ${p.glow} rounded-2xl p-6 flex flex-col gap-4 transition-all duration-200`}>
              <div className="flex items-start justify-between">
                <span className="text-2xl">{p.emoji}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${p.badge}`}>
                  {p.name === "drop" ? "soon" : "live"}
                </span>
              </div>
              <div>
                <h2 className={`text-xl font-bold ${p.accent}`}>{p.name}</h2>
                <p className="text-sm text-white/40 mt-0.5">{p.tagline}</p>
              </div>
              <p className="text-sm text-white/50 leading-relaxed flex-1">{p.description}</p>
              {p.url ? (
                <a href={p.url} target="_blank" rel="noopener noreferrer"
                  className={`text-sm font-semibold ${p.accent} hover:opacity-80 transition`}>
                  {p.cta}
                </a>
              ) : (
                <span className="text-sm text-white/20">{p.cta}</span>
              )}
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="mt-16 border-t border-white/5 pt-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/20">
          <span className="font-mono">slipdeck · protocol family</span>
          <div className="flex gap-6 font-mono">
            <a href="https://github.com/scastradio/slipdeck" target="_blank" rel="noopener noreferrer"
              className="hover:text-white/50 transition">github</a>
            <a href="https://github.com/scastradio/slyce" target="_blank" rel="noopener noreferrer"
              className="hover:text-white/50 transition">slyce contracts</a>
            <a href="https://github.com/scastradio/ante" target="_blank" rel="noopener noreferrer"
              className="hover:text-white/50 transition">ante contracts</a>
          </div>
        </div>
      </div>
    </main>
  );
}
