/**
 * 正文滚过阈值后出现的「回到顶端」按钮。
 */
import { useEffect, useState, type RefObject } from "react";
import { ChevronUp } from "lucide-react";
import { useI18n } from "../i18n";

const THRESHOLD = 240;

export type ScrollToTopButtonProps = {
  scrollRef: RefObject<HTMLElement | null>;
};

export function ScrollToTopButton({ scrollRef }: ScrollToTopButtonProps) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let attached: HTMLElement | null = null;
    const onScroll = () => {
      if (!attached) return;
      setVisible(attached.scrollTop > THRESHOLD);
    };
    const tryAttach = () => {
      const host = scrollRef.current;
      if (!host || host === attached) return;
      if (attached) attached.removeEventListener("scroll", onScroll);
      attached = host;
      attached.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    };
    tryAttach();
    const id = window.setInterval(tryAttach, 500);
    return () => {
      window.clearInterval(id);
      if (attached) attached.removeEventListener("scroll", onScroll);
    };
  }, [scrollRef]);

  if (!visible) return null;

  return (
    <button
      type="button"
      className="mdocs-scroll-top"
      title={t("scrollToTop")}
      aria-label={t("scrollToTop")}
      onClick={() => {
        scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      }}
    >
      <ChevronUp size={18} strokeWidth={2} />
    </button>
  );
}
