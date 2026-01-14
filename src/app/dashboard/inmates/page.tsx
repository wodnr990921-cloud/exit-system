import { redirect } from "next/navigation"
import InmatesClient from "./inmates-client"
import { checkOperatorOrCEOAccess } from "@/lib/.cursorrules/permissions"

export default async function InmatesPage() {
  const { hasAccess } = await checkOperatorOrCEOAccess()

  if (!hasAccess) {
    redirect("/dashboard")
  }

  return <InmatesClient />
}
