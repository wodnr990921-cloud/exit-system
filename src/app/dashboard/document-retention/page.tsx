import { redirect } from "next/navigation"
import DocumentRetentionClient from "./document-retention-client"
import { checkOperatorOrCEOAccess } from "@/lib/.cursorrules/permissions"

export default async function DocumentRetentionPage() {
  const { hasAccess } = await checkOperatorOrCEOAccess()

  if (!hasAccess) {
    redirect("/dashboard")
  }

  return <DocumentRetentionClient />
}


export const dynamic = 'force-dynamic'
