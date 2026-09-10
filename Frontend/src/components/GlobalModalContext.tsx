import { createContext, useContext, useState, ReactNode, useEffect } from "react";

export type GlobalModalType =
  | "newTask"
  | "addEmployee"
  | "applyLeave"
  | "newProject"
  | "newLead"
  | "newMeeting"
  | null;

interface GlobalModalContextType {
  openModal: (type: GlobalModalType) => void;
  closeModal: () => void;
  activeModal: GlobalModalType;
}

const GlobalModalContext = createContext<GlobalModalContextType>({
  openModal: () => {},
  closeModal: () => {},
  activeModal: null,
});

export function GlobalModalProvider({ children }: { children: ReactNode }) {
  const [activeModal, setActiveModal] = useState<GlobalModalType>(null);

  const openModal = (type: GlobalModalType) => setActiveModal(type);
  const closeModal = () => setActiveModal(null);

  // Listen to custom events from legacy code (e.g., sidebar)
  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<{ type: GlobalModalType }>;
      setActiveModal(customEvent.detail.type);
    };
    window.addEventListener("hrms:openModal", handler);
    return () => window.removeEventListener("hrms:openModal", handler);
  }, []);

  return (
    <GlobalModalContext.Provider value={{ openModal, closeModal, activeModal }}>
      {children}
    </GlobalModalContext.Provider>
  );
}

export function useGlobalModal() {
  return useContext(GlobalModalContext);
}

/** Dispatch a global modal open from anywhere in the tree without needing the context */
export function triggerGlobalModal(type: GlobalModalType) {
  window.dispatchEvent(new CustomEvent("hrms:openModal", { detail: { type } }));
}
