import { Suspense } from "react"
import InventoryClient from "./inventory-client"

export const metadata = {
  title: "소모품 재고 | Exit System",
}

export default function InventoryPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <InventoryClient />
    </Suspense>
  )
}
