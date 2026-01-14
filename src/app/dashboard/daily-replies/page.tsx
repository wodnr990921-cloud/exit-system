import DailyRepliesClient from "./daily-replies-client"
import { checkReadAccess } from "@/lib/.cursorrules/permissions"
import { redirect } from "next/navigation"

export default async function DailyRepliesPage() {
  const { hasAccess } = await checkReadAccess()

  if (!hasAccess) {
    redirect("/")
  }

  return <DailyRepliesClient />
}
