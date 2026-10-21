import { requirePortalUser } from "./session";
import { PortalOverview } from "./portal-overview";

export default async function PortalPage() {
  await requirePortalUser("/");
  return <PortalOverview />;
}
