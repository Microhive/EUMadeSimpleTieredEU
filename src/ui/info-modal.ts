import type { ModalContent } from "../domain/tiered-europe";

export interface InfoModal {
  open(content: ModalContent): void;
}

export function createInfoModal(modal: HTMLDialogElement): InfoModal {
  const modalInner = modal.querySelector<HTMLElement>(".modal-inner")!;
  const resetScroll = (): void => {
    modal.scrollTop = 0;
    modalInner.scrollTop = 0;
  };

  modal.querySelector<HTMLButtonElement>(".modal-close")!.addEventListener("click", () => {
    modal.close();
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.close();
  });

  return {
    open(content: ModalContent): void {
      modal.querySelector<HTMLElement>("#modalEyebrow")!.textContent = content.eyebrow;
      modal.querySelector<HTMLElement>(".modal-title")!.textContent = content.title;
      modal.querySelector<HTMLElement>(".modal-subtitle")!.textContent = content.modalTitle;
      modal.querySelector<HTMLElement>(".modal-body")!.textContent = content.modalBody;
      modal.querySelector<HTMLElement>(".modal-key-idea")!.textContent = content.keyIdea;
      modal.querySelector<HTMLElement>(".modal-caveat")!.textContent = content.caveat;
      resetScroll();
      modal.showModal();
      requestAnimationFrame(resetScroll);
    },
  };
}
