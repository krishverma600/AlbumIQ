import { ArrowRight, Camera, Search, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import { weddingPhotos } from "../../assets/weddingVisuals";
import Button from "../common/Button";

function GuestHero() {
  return (
    <section className="page-shell">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
        <div className="editorial-panel reveal-up relative">
          <div className="absolute -right-16 top-10 h-44 w-44 rounded-full bg-[rgba(215,143,98,0.16)] blur-3xl" />
          <div className="relative">
            <div className="flex flex-wrap gap-3">
              <span className="pill reveal-up reveal-delay-1">
                <Sparkles size={14} />
                AI retrieval for weddings
              </span>
              <span className="story-chip reveal-up reveal-delay-2">Made for real guests on mobile</span>
            </div>

            <h1 className="hero-heading reveal-up reveal-delay-2 mt-8 max-w-3xl">
              A calmer way to help every guest find the photos that actually matter to them.
            </h1>
            <p className="subtle-copy reveal-up reveal-delay-3 mt-6 max-w-2xl text-base sm:text-lg">
              FindMyShaadi Pics turns a packed wedding album into a personal photo experience.
              Guests scan a QR, upload one selfie, and open a gallery that feels made just for them.
            </p>

            <div className="reveal-up reveal-delay-4 mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/event/DEMO24">
                <Button className="w-full sm:w-auto">
                  Start guest experience
                  <ArrowRight className="ml-2" size={18} />
                </Button>
              </Link>
              <Link to="/admin/login">
                <Button className="w-full sm:w-auto" variant="secondary">
                  Photographer dashboard
                </Button>
              </Link>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {[
                { icon: Camera, title: "One selfie", text: "No sign-up maze, just a clear upload step guests understand instantly." },
                { icon: Search, title: "Smart matching", text: "Face search narrows a huge album into the moments where that guest appears." },
                { icon: Sparkles, title: "Private reveal", text: "Guests open a personal-looking gallery instead of scanning hundreds of random frames." }
              ].map((item) => (
                <div
                  key={item.title}
                  className="interactive-lift reveal-up rounded-[26px] border border-[rgba(117,82,65,0.1)] bg-[rgba(255,250,246,0.78)] p-5 shadow-[0_16px_35px_rgba(87,56,42,0.07)]"
                >
                  <item.icon className="text-[var(--primary)]" size={22} />
                  <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative min-h-[620px]">
          <div className="photo-frame floating-photo absolute left-0 top-0 h-[420px] w-[72%] rotate-[-5deg]">
            <img alt="Wedding couple portrait" src={weddingPhotos.portrait} />
          </div>
          <div className="photo-frame reveal-up reveal-delay-2 absolute right-0 top-24 h-[270px] w-[42%] rotate-[4deg]">
            <img alt="Wedding celebration" src={weddingPhotos.ceremony} />
          </div>
          <div className="editorial-panel reveal-up reveal-delay-3 absolute bottom-0 left-[10%] w-[74%] bg-[rgba(255,250,246,0.92)]">
            <p className="pill">Guest Journey</p>
            <div className="mt-6 space-y-4">
              {[
                "Scan the QR on the invitation or enter the event code",
                "Upload a clean selfie in a few taps",
                "Let the AI search the event album in the background",
                "Open a gallery built around your own presence in the wedding"
              ].map((step, index) => (
                <div key={step} className="interactive-lift flex items-start gap-4 rounded-[22px] border border-[rgba(117,82,65,0.1)] bg-white/72 px-4 py-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-sm font-bold text-white">
                    {index + 1}
                  </div>
                  <p className="text-sm font-medium leading-6 text-[var(--text)]">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default GuestHero;
