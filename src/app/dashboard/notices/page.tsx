import { redirect } from "next/navigation"
import NoticesClient from "./notices-client"
import { checkOperatorOrCEOAccess } from "@/lib/.cursorrules/permissions"

export default async function NoticesPage() {
  const { hasAccess } = await checkOperatorOrCEOAccess()

  if (!hasAccess) {
    redirect("/dashboard")
  }

  return <NoticesClient />
}
