import { requirePortalUser } from "../session";
import { CreateWorkspaceForm } from "./create-workspace-form";

export default async function NewWorkspacePage() {
  await requirePortalUser("/new");
  return <CreateWorkspaceForm />;
}
