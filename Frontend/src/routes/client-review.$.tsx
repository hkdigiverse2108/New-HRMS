import { createFileRoute } from "@tanstack/react-router";
import { ClientReviewPortal } from "@/components/work/ClientReviewPortal";

export const Route = createFileRoute("/client-review/$")({
  head: () => ({
    meta: [
      { title: "Content Calendar Review — Client Portal" },
      { name: "description", content: "Review and approve content calendar deliverables" },
    ],
  }),
  component: ClientReviewPortal,
});
