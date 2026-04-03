import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#080c14] text-white">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <span className="text-xl font-bold tracking-tight text-emerald-400">ante</span>
        <div className="flex items-center gap-4">
          <Link href="/pots" className="text-sm text-white/50 hover:text-white transition">Browse pots</Link>
          <Link href="/create" className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition">
            Create pot →
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-24 text-center space-y-8">
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 text-sm text-emerald-400">
          ♠ Group contributions on Solana · Devnet
        </div>

        <h1 className="text-5xl font-bold leading-tight">
          Ante up.<br />
          <span className="text-emerald-400">Everyone chips in.</span>
        </h1>

        <p className="text-lg text-white/50 max-w-xl mx-auto">
          Create a pot, invite up to 10 contributors, set your terms.
          Funds release to the recipient automatically — or only when you say so.
        </p>

        <div className="flex items-center justify-center gap-4">
          <Link
            href="/create"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-8 py-3.5 rounded-2xl transition text-base"
          >
            Create a pot
          </Link>
          <Link
            href="/pots"
            className="bg-white/5 hover:bg-white/10 text-white font-semibold px-8 py-3.5 rounded-2xl transition text-base border border-white/10"
          >
            View pots
          </Link>
        </div>
      </div>

      {/* How it works */}
      <div className="max-w-4xl mx-auto px-6 pb-24 grid md:grid-cols-3 gap-6">
        {[
          {
            icon: "♠",
            title: "Create",
            body: "Add contributor wallets, a recipient, the amount each person owes, and your release terms.",
          },
          {
            icon: "💰",
            title: "Everyone antes up",
            body: "Contributors connect and deposit their share. The pot tracks who's in and who's still out.",
          },
          {
            icon: "✅",
            title: "Pot's right — release",
            body: "Once conditions are met, funds go straight to the recipient. Auto or manual — your call.",
          },
        ].map((s) => (
          <div key={s.title} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
            <span className="text-3xl">{s.icon}</span>
            <h3 className="font-semibold text-lg">{s.title}</h3>
            <p className="text-white/50 text-sm leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
