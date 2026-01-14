import { redirect } from "next/navigation"
import TransactionsClient from "./transactions-client"
import { checkOperatorOrCEOAccess } from "@/lib/.cursorrules/permissions"

export default async function BankTransactionsPage() {
  const { hasAccess } = await checkOperatorOrCEOAccess()

  if (!hasAccess) {
    redirect("/dashboard")
  }

  return <TransactionsClient />
}
