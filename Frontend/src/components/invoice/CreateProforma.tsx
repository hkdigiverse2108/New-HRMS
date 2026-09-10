import { CreateInvoice } from "./CreateInvoice";

export function CreateProforma({ onBack }: { onBack?: (() => void) | undefined }) {
  return <CreateInvoice onBack={onBack} isProforma={true} />;
}
