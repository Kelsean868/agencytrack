import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';

const SLIDES = [
  {
    title: 'Welcome to AgencyTrack',
    body: "Your personal sales performance hub. Track your weekly activity, measure progress toward your goals, and stay on top of every target — all in one place.",
  },
  {
    title: 'Your Weekly Report',
    body: "Every week, tap 'Start Weekly Report' to log your activity. It takes less than 5 minutes. Submit before Monday 9:00 AM to stay compliant.",
  },
  {
    title: 'Track Your Progress',
    body: "Your dashboard shows your KPIs, award progress, and where you stand against your targets. Check the Career tab to see your path to the next level.",
  },
  {
    title: "You're All Set",
    body: "Your manager will guide you through the rest. If you ever need to revisit this tour, ask your manager to reset it for you.",
    isLast: true,
  },
];

export default function WelcomeScreen({ onComplete }) {
  const { user, tenantId } = useAuth();
  const [index, setIndex] = useState(0);
  const [completing, setCompleting] = useState(false);

  const slide = SLIDES[index];

  async function complete() {
    if (completing) return;
    setCompleting(true);
    try {
      if (user?.uid && tenantId) {
        await updateDoc(doc(db, `tenants/${tenantId}/users/${user.uid}`), {
          hasSeenWelcome: true,
        });
      }
    } catch (err) {
      console.error('[WelcomeScreen] updateDoc:', err);
    } finally {
      onComplete();
    }
  }

  function next() {
    if (index < SLIDES.length - 1) setIndex(index + 1);
    else complete();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden">
        {/* Skip button */}
        <button
          onClick={complete}
          className="absolute top-4 right-4 text-xs text-ink-muted hover:text-ink transition-colors"
        >
          Skip
        </button>

        {/* Brand mark — persistent across all slides */}
        <div className="flex justify-center pt-10 pb-0">
          <img
            src="/icons.svg"
            alt="AgencyTrack"
            className="w-28 h-28 dark:ring-1 dark:ring-white/10 rounded-[22px]"
          />
        </div>

        {/* Slide content */}
        <div className="flex flex-col items-center text-center px-8 pt-4 pb-6 gap-4">
          <h2 className="font-display font-bold text-xl text-ink leading-snug">{slide.title}</h2>
          <p className="text-sm text-ink-muted leading-relaxed">{slide.body}</p>
        </div>

        {/* Dot indicators */}
        <div className="flex items-center justify-center gap-2 pb-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`rounded-full transition-all duration-200 ${
                i === index ? 'w-5 h-1.5 bg-primary' : 'w-1.5 h-1.5 bg-primary/30'
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>

        {/* Action button */}
        <div className="px-8 pb-8 pt-2">
          {slide.isLast ? (
            <button onClick={complete} disabled={completing} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
              {completing ? 'Starting…' : 'Get Started'}
            </button>
          ) : (
            <button onClick={next} className="btn-primary w-full flex items-center justify-center gap-1.5">
              Next <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
