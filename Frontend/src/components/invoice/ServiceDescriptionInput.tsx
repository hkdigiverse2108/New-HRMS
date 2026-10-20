import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { InvoiceService } from "@/lib/invoice-services";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

interface Props {
  value: string;
  services: InvoiceService[];
  placeholder?: string;
  onChange: (text: string) => void;
  /** A catalog service was chosen: the caller fills SAC, rate and discount from it. */
  onPick: (service: InvoiceService) => void;
}

const inr = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

/** Item description box with a dropdown of catalog services. Typing custom text still works. */
export function ServiceDescriptionInput({ value, services, placeholder, onChange, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  const query = value.trim().toLowerCase();
  // Once the text equals a service exactly, show the whole list again so another one can be picked
  const exact = services.some((s) => s.description.toLowerCase() === query);
  const matches = !query || exact ? services : services.filter((s) => s.description.toLowerCase().includes(query));

  return (
    <Popover open={open && services.length > 0} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div ref={anchorRef} className="relative">
          <input
            type="text"
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
            placeholder={placeholder}
            className={cn(
              "w-full h-11 pl-3.5 bg-background border border-border/70 rounded-xl text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20",
              services.length > 0 ? "pr-9" : "pr-3.5"
            )}
          />
          {services.length > 0 && (
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setOpen((o) => !o)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              aria-label="Show services"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          )}
        </div>
      </PopoverAnchor>

      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) min-w-[300px] p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          // Clicking the input itself is not "outside"
          if (anchorRef.current?.contains(e.target as Node)) e.preventDefault();
        }}
      >
        {matches.length === 0 ? (
          <p className="px-3 py-2.5 text-xs font-medium text-muted-foreground">
            No matching service. Your text will be used as a custom item.
          </p>
        ) : (
          <ul className="max-h-64 overflow-y-auto">
            {matches.map((s) => (
              <li key={s._id}>
                <button
                  type="button"
                  // Keep focus in the input so the dropdown doesn't flicker
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onPick(s);
                    setOpen(false);
                  }}
                  className="w-full text-left rounded-lg px-3 py-2 hover:bg-muted transition-colors"
                >
                  <span className="block text-sm font-bold text-foreground">{s.description}</span>
                  <span className="block text-[11px] font-medium text-muted-foreground">
                    {s.sac ? `SAC ${s.sac} · ` : ""}₹ {inr(s.rate)}
                    {s.discount_amount ? ` · ₹ ${inr(s.discount_amount)} off (${s.discount}%)` : ""} · Amount ₹ {inr(s.amount)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
