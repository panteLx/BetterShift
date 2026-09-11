import { redirect } from "next/navigation";

// Old bookmarks; the activity log is a section of the profile page now
export default function ActivityLogRedirect() {
  redirect("/profile?section=activity");
}
