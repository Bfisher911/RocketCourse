import { LogoMark } from "./brand";
import type { Screen } from "../types";

// Shared footer for all public (pre-login) surfaces. Links cover the full public IA so users can
// reach Home, Pricing, About, Guides, Contact, Demo, Terms, and Privacy from anywhere.
const FOOTER_LINKS: Array<{ label: string; screen: Screen }> = [
  { label: "Home", screen: "landing" },
  { label: "Pricing", screen: "pricing" },
  { label: "About", screen: "about" },
  { label: "Guides", screen: "guides" },
  { label: "Contact", screen: "contact" },
  { label: "Demo", screen: "demo" },
  { label: "Terms", screen: "terms" },
  { label: "Privacy", screen: "privacy" }
];

export function PublicFooter({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const year = new Date().getFullYear();
  return (
    <footer className="public-footer" aria-label="Footer">
      <div className="public-footer-inner">
        <div className="public-footer-brand">
          <LogoMark size={40} decorative />
          <div>
            <strong>RocketCourse</strong>
            <small>Canvas-first AI course builder</small>
          </div>
        </div>
        <nav className="public-footer-links" aria-label="Footer navigation">
          {FOOTER_LINKS.map((link) => (
            <button key={link.screen} type="button" onClick={() => onNavigate(link.screen)}>
              {link.label}
            </button>
          ))}
          <a href="/integration">Integrations</a>
        </nav>
      </div>
      <div className="public-footer-legal">
        <p>© {year} RocketCourse. Built by Dr. Blaine Fisher.</p>
        <p className="muted-note">
          Canvas-oriented <strong>.imscc</strong> export. RocketCourse is not affiliated with or endorsed by Instructure
          or Canvas. Always review generated content and test in a blank Canvas course before using it with students.
        </p>
      </div>
    </footer>
  );
}
