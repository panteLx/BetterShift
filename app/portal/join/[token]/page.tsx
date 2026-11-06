import { requirePortalUser } from "../../session";
import { JoinConfirm } from "./join-confirm";

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await requirePortalUser(`/join/${token}`);
  return <JoinConfirm token={token} />;
}
