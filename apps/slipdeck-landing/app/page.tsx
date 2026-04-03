import Link from "next/link";

const PRODUCTS = [
  {
    emoji: "🔪",
    name: "slyce",
    tagline: "Trustless split payments",
    description: "Create a split, share the link. Anyone deposits, every recipient gets their exact cut — no middleman, no trust required.",
    url: "https://slyce-web-seven.vercel.app",
    accent: "text-blue-400",
    border: "hover:border-blue-500/40",
    bg: "hover:bg-blue-500/5",
    badge: "bg-blue-500/10 text-blue-400",
    status: "live",
  },
  {
    emoji: "♠",
    name: "ante",
    tagline: "Group contribution vaults",
    description: "Everyone puts their chips in. Funds lock on-chain until the threshold is met, then release to the recipient automatically.",
    url: "https://ante-web.vercel.app",
    accent: "text-emerald-400",
    border: "hover:border-emerald-500/40",
    bg: "hover:bg-emerald-500/5",
    badge: "bg-emerald-500/10 text-emerald-400",
    status: "live",
  },
  {
    emoji: "📦",
    name: "drop",
    tagline: "Token airdrop infrastructure",
    description: "Upload a wallet list, get a fee estimate, confirm. The contract handles distribution — push it out or let recipients claim.",
    url: "https://drop-web-ruby.vercel.app",
    accent: "text-amber-400",
    border: "hover:border-amber-500/30",
    bg: "hover:bg-amber-500/5",
    badge: "bg-amber-500/10 text-amber-400",
    status: "live",
  },
  {
    emoji: "⚔️",
    name: "dirge",
    tagline: "Last one standing elimination games",
    description: "Admin creates a game, players pay entry, one gets eliminated on a timer. Last N standing split the prize pool — everyone dies, someone wins.",
    url: "https://dirge-web.vercel.app",
    accent: "text-red-400",
    border: "hover:border-red-500/40",
    bg: "hover:bg-red-500/5",
    badge: "bg-red-500/10 text-red-400",
    status: "live",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#080c14] text-white">

      {/* Hero */}
      <div className="max-w-5xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-xs text-white/40 mb-8 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          devnet · solana
        </div>

        <h1 className="text-6xl font-bold tracking-tight mb-4">
          <span className="text-violet-400">slip</span>deck
        </h1>
        <p className="text-xl text-white/50 max-w-xl mx-auto leading-relaxed">
          A suite of on-chain protocols for moving money without the paperwork.
        </p>

        <div className="flex items-center justify-center gap-3 mt-8">
          <a href="https://github.com/scastradio/slipdeck" target="_blank" rel="noopener noreferrer"
            className="bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-sm px-5 py-2.5 rounded-xl transition font-mono">
            github ↗
          </a>
        </div>
      </div>

      {/* Products */}
      <div className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PRODUCTS.map((p) => (
            <div key={p.name}
              className={`relative bg-[#0e1420] border border-white/8 ${p.border} ${p.bg} rounded-2xl p-6 transition group flex flex-col`}>

              {/* Status badge */}
              <div className="flex items-center justify-between mb-6">
                <span className={`text-xs px-2.5 py-1 rounded-full font-mono ${p.badge}`}>
                  {p.status === "live" ? "● live" : "○ soon"}
                </span>
                <span className="text-2xl">{p.emoji}</span>
              </div>

              {/* Content */}
              <div className="flex-1">
                <h2 className={`text-2xl font-bold tracking-tight mb-1 ${p.accent}`}>
                  {p.name}
                </h2>
                <p className="text-sm text-white/50 font-medium mb-3">{p.tagline}</p>
                <p className="text-sm text-white/35 leading-relaxed">{p.description}</p>
              </div>

              {/* CTA */}
              <div className="mt-6 pt-4 border-t border-white/5">
                {p.url ? (
                  <a href={p.url} target="_blank" rel="noopener noreferrer"
                    className={`text-sm font-semibold ${p.accent} hover:opacity-80 transition`}>
                    Open app →
                  </a>
                ) : (
                  <span className="text-sm text-white/20">Coming soon</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Built on Solana strip */}
      <div className="border-t border-white/5 py-8">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between">
          <p className="text-xs text-white/20 font-mono">
            built on solana · open source · devnet
          </p>
          <div className="flex gap-6 text-xs text-white/20 font-mono">
            <a href="https://github.com/scastradio/slyce" target="_blank" rel="noopener noreferrer" className="hover:text-white/50 transition">slyce</a>
            <a href="https://github.com/scastradio/ante" target="_blank" rel="noopener noreferrer" className="hover:text-white/50 transition">ante</a>
            <a href="https://github.com/scastradio/slipdeck" target="_blank" rel="noopener noreferrer" className="hover:text-white/50 transition">slipdeck</a>
            <a href="https://github.com/scastradio/dirge" target="_blank" rel="noopener noreferrer" className="hover:text-white/50 transition">dirge</a>
          </div>
        </div>
      </div>

    </main>
  );
}
