import { ArrowRight, CheckCircle2, ShieldCheck, TimerReset } from "lucide-react";
import { Link } from "react-router-dom";

import { weddingHighlights, weddingPhotos } from "../../assets/weddingVisuals";
import Button from "../../components/common/Button";
import GuestHero from "../../components/guest/GuestHero";

function HomePage() {
  return (
    <>
      <GuestHero />

      <section className="page-shell pt-0">
        <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="editorial-panel reveal-up">
            <span className="pill">Why guests understand it faster</span>
            <h2 className="section-heading mt-6 max-w-3xl">
              The product should feel like a wedding service, not like a software demo.
            </h2>
            <p className="subtle-copy mt-5 max-w-2xl">
              We keep the guest flow short, visual, and reassuring. The language is simpler, the key steps are visible, and the event feels personalized from the very first screen.
            </p>

            <div className="stagger-list mt-8 grid gap-4 md:grid-cols-3">
              {[
                {
                  icon: TimerReset,
                  title: "Short guest flow",
                  text: "Code, selfie, results. The journey stays understandable even for non-technical family members."
                },
                {
                  icon: ShieldCheck,
                  title: "Event-specific privacy",
                  text: "Every wedding stays isolated behind its own QR and event code so guests land in the right album."
                },
                {
                  icon: CheckCircle2,
                  title: "Photographer control",
                  text: "Admins manage a single event workspace for uploads, access, QR sharing, and guest retrieval."
                }
              ].map((item) => (
                <article key={item.title} className="interactive-lift rounded-[24px] border border-[rgba(117,82,65,0.1)] bg-white/74 p-5">
                  <item.icon className="text-[var(--primary)]" size={22} />
                  <h3 className="mt-4 text-lg font-semibold text-[var(--text)]">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.text}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="photo-frame reveal-up reveal-delay-2 h-full min-h-[520px]">
            <img alt="Wedding editorial detail" src={weddingPhotos.editorial} />
          </div>
        </div>
      </section>

      <section className="page-shell pt-0">
        <div className="mx-auto max-w-7xl">
          <div className="reveal-up mb-6 flex items-end justify-between gap-4">
            <div>
              <span className="pill">Photo-led understanding</span>
              <h2 className="section-heading mt-5">What the platform feels like at a glance.</h2>
            </div>
            <Link to="/event/DEMO24">
              <Button variant="secondary">
                Try the guest flow
                <ArrowRight className="ml-2" size={18} />
              </Button>
            </Link>
          </div>

          <div className="stagger-list grid gap-6 lg:grid-cols-3">
            {weddingHighlights.map((item) => (
              <article key={item.title} className="editorial-panel interactive-lift p-4">
                <div className="photo-frame h-72">
                  <img alt={item.title} src={item.image} />
                </div>
                <div className="px-2 pb-2 pt-5">
                  <h3 className="text-2xl font-semibold text-[var(--text)]">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{item.copy}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export default HomePage;
