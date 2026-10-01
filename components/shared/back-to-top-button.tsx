"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const doc = document.documentElement;
      const canScroll = doc.scrollHeight - window.innerHeight > 160;
      setVisible(canScroll && scrollTop > 280);
    };

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    window.addEventListener("resize", updateVisibility);

    return () => {
      window.removeEventListener("scroll", updateVisibility);
      window.removeEventListener("resize", updateVisibility);
    };
  }, []);

  const handleBackToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <button
      type="button"
      onClick={handleBackToTop}
      tabIndex={visible ? 0 : -1}
      aria-label="回到顶部"
      className={[
        "fixed bottom-6 right-6 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full",
        "border border-border bg-card text-foreground shadow-lg",
        "transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent hover:shadow-[0_22px_45px_-24px_rgba(0,0,0,0.34)] active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        visible ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
      ].join(" ")}
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}
