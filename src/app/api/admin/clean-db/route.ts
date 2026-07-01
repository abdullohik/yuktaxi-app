import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/admin/clean-db
 * Deletes ALL demo data: orders, users, drivers, reviews, photos, etc.
 * Keeps the schema intact (tables exist, just empty).
 *
 * This is a destructive operation — use with caution.
 * In production, protect with admin auth.
 */
export async function POST(_req: NextRequest) {
  try {
    // Delete in dependency order (children first, parents last)
    // 1. AIComparison (depends on Order)
    // 2. OrderPhoto (depends on Order)
    // 3. Review (depends on Order)
    // 4. ChatMessage (depends on Order + User)
    // 5. OrderStatusHistory (depends on Order)
    // 6. Payment (no FK, just String orderId — safe to delete)
    // 7. EarningsEvent (depends on Driver)
    // 8. SavedAddress (depends on User)
    // 9. Order (depends on User via customerPhone/driverPhone)
    // 10. Driver (depends on User)
    // 11. Notification (depends on User)
    // 12. User (parent)

    await db.aIComparison.deleteMany();
    await db.orderPhoto.deleteMany();
    await db.review.deleteMany();
    await db.chatMessage.deleteMany();
    await db.orderStatusHistory.deleteMany();
    await db.payment.deleteMany();
    await db.earningsEvent.deleteMany();
    await db.savedAddress.deleteMany();
    await db.order.deleteMany();
    await db.driver.deleteMany();
    await db.notification.deleteMany();
    await db.user.deleteMany();

    return NextResponse.json({
      ok: true,
      data: {
        message: "Database cleaned — all demo data removed",
        tablesCleared: [
          "AIComparison", "OrderPhoto", "Review", "ChatMessage",
          "OrderStatusHistory", "Payment", "EarningsEvent",
          "SavedAddress", "Order", "Driver", "Notification", "User"
        ],
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
