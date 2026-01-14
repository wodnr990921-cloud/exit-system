import { redirect } from "next/navigation"
import PointsClient from "./points-client"
import { checkOperatorOrCEOAccess } from "@/lib/.cursorrules/permissions"

export default async function PointsPage() {
  const { hasAccess } = await checkOperatorOrCEOAccess()

  if (!hasAccess) {
    redirect("/dashboard") // Redirect to dashboard if no access
  }

  return <PointsClient />
}
