import { SiteHeader } from "@/components/site-header";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="theme-shell">
      <SiteHeader />
      <div className="page-frame">{children}</div>
    </div>
  );
}
