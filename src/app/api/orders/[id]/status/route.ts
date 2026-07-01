import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shapeOrder, ORDER_INCLUDE } from "@/lib/server/orders-helpers";

const ORDER_FLOW: string[] = [
  "SEARCHING",
  "ACCEPTED",
  "ARRIVING",
  "ARRIVED",
  "LOADED",
  "IN_TRANSIT",
  "DELIVERED",
  "COMPLETED",
];

function isForwardOrCancel(from: string, to: string): boolean {
  if (to === "CANCELLED") {
    return ["SEARCHING", "ACCEPTED", "ARRIVING", "ARRIVED", "LOADED"].includes(
      from
    );
  }
  const fi = ORDER_FLOW.indexOf(from);
  const ti = ORDER_FLOW.indexOf(to);
  if (fi < 0 || ti < 0) return false;
  return ti >= fi; // allow forward (or same)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const status = String(body?.status ?? "").toUpperCase();
    const note = body?.note ? String(body.note) : null;

    const order = await db.order.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });
    if (!order) {
      return NextResponse.json(
        { ok: false, error: "Buyurtma topilmadi" },
        { status: 404 }
      );
    }
    if (!ORDER_FLOW.includes(status) && status !== "CANCELLED") {
      return NextResponse.json(
        { ok: false, error: `Noto'g'ri status: ${status}` },
        { status: 400 }
      );
    }
    if (!isForwardOrCancel(order.status, status)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Status ${order.status} → ${status} o'tib bo'lmaydi`,
        },
        { status: 400 }
      );
    }

    const update: {
      status: string;
      acceptedAt?: Date;
      pickedUpAt?: Date;
      deliveredAt?: Date;
    } = { status };
    if (status === "ACCEPTED") update.acceptedAt = new Date();
    if (status === "LOADED") update.pickedUpAt = new Date();
    if (status === "DELIVERED") update.deliveredAt = new Date();

    const updated = await db.order.update({
      where: { id },
      data: update,
      include: ORDER_INCLUDE,
    });

    await db.orderStatusHistory.create({
      data: { orderId: id, status, note },
    });

    // On COMPLETED: create EarningsEvent + bump driver totals
    if (status === "COMPLETED" && order.driverPhone) {
      const driverUser = await db.user.findUnique({
        where: { phone: order.driverPhone },
        include: { driver: true },
      });
      if (driverUser?.driver) {
        const amount = Math.round(order.priceSom * 0.8);
        await db.earningsEvent.create({
          data: {
            driverId: driverUser.driver.id,
            orderId: id,
            amount,
          },
        });
        // Recompute rating from reviews on this driver's orders.
        const reviewsAgg = await db.review.aggregate({
          _avg: { rating: true },
          _count: { rating: true },
          where: {
            order: { driverPhone: order.driverPhone },
          },
        });
        const newRating =
          reviewsAgg._avg.rating != null
            ? +reviewsAgg._avg.rating.toFixed(2)
            : driverUser.driver.rating;
        await db.driver.update({
          where: { id: driverUser.driver.id },
          data: {
            totalTrips: { increment: 1 },
            balance: { increment: amount },
            rating: newRating,
          },
        });
      }
    }

    return NextResponse.json({ ok: true, data: shapeOrder(updated) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
