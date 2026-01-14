import { redirect } from "next/navigation"
import DormantPointsClient from "./dormant-points-client"
import { checkOperatorOrCEOAccess } from "@/lib/.cursorrules/permissions"

export default async function DormantPointsPage() {
  const { hasAccess } = await checkOperatorOrCEOAccess()

  if (!hasAccess) {
    redirect("/dashboard")
  }

  return <DormantPointsClient />
}
