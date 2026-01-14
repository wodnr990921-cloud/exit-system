import { redirect } from "next/navigation"
import BankClient from "./bank-client"
import { checkOperatorOrCEOAccess } from "@/lib/.cursorrules/permissions"

export default async function BankPage() {
  const { hasAccess } = await checkOperatorOrCEOAccess()

  if (!hasAccess) {
    redirect("/dashboard") // Redirect to dashboard if no access
  }

  return <BankClient />
}
