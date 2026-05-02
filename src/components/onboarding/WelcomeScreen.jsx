import { useState } from 'react';
import { Trophy, FileText, TrendingUp, CheckCircle2, ChevronRight } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';

const TENANT_ID = import.meta.env.VITE_TENANT_ID;

const SLIDES = [
  {
    Icon: Trophy,
    title: 'Welcome to AgencyTrack',
    body: "Your personal sales performance hub. Track your weekly activity, measure progress toward your goals, and stay on top of every target — all in one place.",
  },
  {
    Icon: FileText,
    title: 'Your Weekly Report',
    body: "Every week, tap 'Start Weekly Report' to log your activity. It takes less than 5 minutes. Submit before Monday 9:00 AM to stay compliant.",
  },
  {
    Icon: TrendingUp,
    title: 'Track Your Progress',
    body: "Your dashboard shows your KPIs, award progress, and where you stand against your targets. Check the Career tab to see your path to the next level.",
  },
  {
    Icon: CheckCircle2,
    title: "You're All Set",
    body: "Your manager will guide you through the rest. If you ever need to revisit this tour, ask your manager to reset it for you.",
    isLast: true,
  },
];

export default function WelcomeScreen({ onComplete }) {
  const { user } = useAuth();
  const [index, setIndex] = useState(0);
  const [completing, setCompleting] = useState(false);

  const slide = SLIDES[index];

  async function complete() {
    if (completing) return;
    setCompleting(true);
    try {
      if (user?.uid) {
        await updateDoc(doc(db, `tenants/${TENANT_ID}/users/${user.uid}`), {
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
      <div className="relative bg-[var(--color-surface)] rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden">
        {/* Skip button */}
        <button
          onClick={complete}
          className="absolute top-4 right-4 text-xs text-ink-muted hover:text-ink transition-colors"
        >
          Skip
        </button>

        {/* Slide content */}
        <div className="flex flex-col items-center text-center px-8 pt-12 pb-6 gap-4">
          <slide.Icon size={48} className="text-primary" />
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
