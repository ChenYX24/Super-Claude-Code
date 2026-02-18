"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function useKeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      // Number keys 1-7 for page navigation
      const pages = ["/", "/team", "/sessions", "/tokens", "/toolbox", "/editor", "/settings"];
      const num = parseInt(e.key);
      if (num >= 1 && num <= 7 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        router.push(pages[num - 1]);
        return;
      }

      // ? for help dialog
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent("toggle-shortcuts-help"));
        return;
      }

      // / to focus search (if a search input exists on page)
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        const searchInput = document.querySelector('input[type="text"][placeholder*="Search"]') as HTMLInputElement;
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router]);
}
