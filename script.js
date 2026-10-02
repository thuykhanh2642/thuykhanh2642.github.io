const themeStorageKey = "portfolio-theme";
let currentTheme = "dark";

try {
  currentTheme = localStorage.getItem(themeStorageKey) === "light" ? "light" : "dark";
} catch {
  currentTheme = "dark";
}

function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.dataset.theme = theme;

  const toggle = document.querySelector(".theme-toggle");
  if (toggle) {
    const switchingToLight = theme === "dark";
    toggle.textContent = switchingToLight ? "Light mode" : "Dark mode";
    toggle.setAttribute("aria-label", switchingToLight ? "Switch to light mode" : "Switch to dark mode");
  }
}

applyTheme(currentTheme);

const themeToggle = document.querySelector(".theme-toggle");
if (themeToggle) {
  applyTheme(currentTheme);

  themeToggle.addEventListener("click", () => {
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);

    try {
      localStorage.setItem(themeStorageKey, nextTheme);
    } catch {
      // The selected theme still works for the current visit when storage is unavailable.
    }
  });
}

const yearNode = document.getElementById("year");
if (yearNode) {
  yearNode.textContent = new Date().getFullYear();
}

const quietHome = document.querySelector(".quiet-home");
const canUsePointerMotion = window.matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)").matches;

if (canUsePointerMotion) {
  let haloAnimationFrame;
  let cardAnimationFrame;
  let activeCard;
  document.body.classList.add("has-pointer-halo");

  window.addEventListener("pointermove", (event) => {
    cancelAnimationFrame(haloAnimationFrame);
    haloAnimationFrame = requestAnimationFrame(() => {
      document.documentElement.style.setProperty("--pointer-x", `${event.clientX}px`);
      document.documentElement.style.setProperty("--pointer-y", `${event.clientY}px`);
    });
  }, { passive: true });

  document.querySelectorAll(".page-hero-card, .featured-card").forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      const bounds = card.getBoundingClientRect();
      const cardX = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left));
      const cardY = Math.max(0, Math.min(bounds.height, event.clientY - bounds.top));
      activeCard = card;

      cancelAnimationFrame(cardAnimationFrame);
      cardAnimationFrame = requestAnimationFrame(() => {
        activeCard.style.setProperty("--card-pointer-x", `${cardX.toFixed(1)}px`);
        activeCard.style.setProperty("--card-pointer-y", `${cardY.toFixed(1)}px`);
        activeCard.style.setProperty("--card-glow-color", "var(--card-glow)");
      });
    }, { passive: true });

    card.addEventListener("pointerleave", () => {
      cancelAnimationFrame(cardAnimationFrame);
      card.style.setProperty("--card-glow-color", "transparent");
    });
  });
}

if (quietHome && canUsePointerMotion) {
  const hero = quietHome.querySelector(".quiet-hero");
  const heroMedia = quietHome.querySelector(".quiet-hero-media");
  let animationFrame;

  const resetHeroMotion = () => {
    quietHome.style.setProperty("--quiet-media-x", "0px");
    quietHome.style.setProperty("--quiet-media-y", "0px");
    quietHome.style.setProperty("--quiet-tilt-x", "0deg");
    quietHome.style.setProperty("--quiet-tilt-y", "0deg");
    quietHome.style.setProperty("--quiet-glare-opacity", "0");
  };

  if (hero && heroMedia) {
    hero.addEventListener("pointermove", (event) => {
      const mediaBounds = heroMedia.getBoundingClientRect();
      const relativeX = Math.max(-0.5, Math.min(0.5, (event.clientX - mediaBounds.left) / mediaBounds.width - 0.5));
      const relativeY = Math.max(-0.5, Math.min(0.5, (event.clientY - mediaBounds.top) / mediaBounds.height - 0.5));

      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        quietHome.style.setProperty("--quiet-media-x", `${(relativeX * 12).toFixed(2)}px`);
        quietHome.style.setProperty("--quiet-media-y", `${(relativeY * 12).toFixed(2)}px`);
        quietHome.style.setProperty("--quiet-tilt-x", `${(-relativeY * 7).toFixed(2)}deg`);
        quietHome.style.setProperty("--quiet-tilt-y", `${(relativeX * 8).toFixed(2)}deg`);
        quietHome.style.setProperty("--quiet-glare-x", `${((relativeX + 0.5) * 100).toFixed(1)}%`);
        quietHome.style.setProperty("--quiet-glare-y", `${((relativeY + 0.5) * 100).toFixed(1)}%`);
        quietHome.style.setProperty("--quiet-glare-opacity", "1");
      });
    }, { passive: true });

    hero.addEventListener("pointerleave", resetHeroMotion);
  }
}
