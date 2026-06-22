interface FloatingTooltipOptions {
  resolveAssetSrc: (assetPath: string) => string;
}

export interface FloatingTooltip {
  show(anchor: HTMLElement): void;
  hide(delayMs?: number): void;
}

export function createFloatingTooltip({ resolveAssetSrc }: FloatingTooltipOptions): FloatingTooltip {
  const tooltipEl = document.createElement("div");
  tooltipEl.className = "pill-tooltip";
  tooltipEl.setAttribute("role", "tooltip");
  tooltipEl.setAttribute("aria-hidden", "true");
  document.body.appendChild(tooltipEl);

  let tooltipTimer: ReturnType<typeof setTimeout> | null = null;

  const cancelHide = (): void => {
    if (!tooltipTimer) return;
    clearTimeout(tooltipTimer);
    tooltipTimer = null;
  };

  const hide = (delayMs = 100): void => {
    if (tooltipTimer) clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(() => {
      tooltipEl.classList.remove("is-visible");
      tooltipEl.setAttribute("aria-hidden", "true");
    }, delayMs);
  };

  const show = (anchor: HTMLElement): void => {
    cancelHide();
    const text = anchor.dataset.tooltip ?? "";
    const title = anchor.dataset.tooltipTitle ?? "";
    const image = anchor.dataset.tooltipImage ?? "";
    const credit = anchor.dataset.tooltipCredit ?? "";
    const creditUrl = anchor.dataset.tooltipCreditUrl ?? "";
    if (!text && !title && !image && !credit) return;

    tooltipEl.replaceChildren();
    tooltipEl.classList.toggle("has-media", Boolean(image));
    tooltipEl.style.width = image ? "320px" : "280px";

    if (image) {
      const img = document.createElement("img");
      img.className = "pill-tooltip-image";
      img.src = resolveAssetSrc(image);
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";

      if (anchor instanceof HTMLAnchorElement) {
        const link = document.createElement("a");
        link.className = "pill-tooltip-image-link";
        link.href = anchor.href;
        link.target = anchor.target;
        link.rel = anchor.rel;
        link.setAttribute("aria-label", anchor.ariaLabel || title || "Open video");
        link.addEventListener("click", () => hide(0));
        link.appendChild(img);
        tooltipEl.appendChild(link);
      } else {
        tooltipEl.appendChild(img);
      }
    }

    if (title) {
      const titleEl = document.createElement("strong");
      titleEl.className = "pill-tooltip-title";
      titleEl.textContent = title;
      tooltipEl.appendChild(titleEl);
    }

    if (text) {
      const bodyEl = document.createElement("span");
      bodyEl.className = "pill-tooltip-body";
      bodyEl.textContent = text;
      tooltipEl.appendChild(bodyEl);
    }

    if (credit) {
      const creditEl = document.createElement(creditUrl ? "a" : "span");
      creditEl.className = "pill-tooltip-credit";
      creditEl.textContent = credit;

      if (creditEl instanceof HTMLAnchorElement) {
        creditEl.href = creditUrl;
        creditEl.target = "_blank";
        creditEl.rel = "noopener noreferrer";
        creditEl.addEventListener("click", () => hide(0));
      }

      tooltipEl.appendChild(creditEl);
    }

    tooltipEl.classList.add("is-visible");
    tooltipEl.setAttribute("aria-hidden", "false");
    const rect = anchor.getBoundingClientRect();
    const tooltipWidth = image ? 320 : 280;
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tooltipWidth - 8));
    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top = `${rect.bottom + 10}px`;
  };

  tooltipEl.addEventListener("mouseenter", cancelHide);
  tooltipEl.addEventListener("mouseleave", () => hide(140));

  return { show, hide };
}
