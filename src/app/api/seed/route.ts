import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Seed: creates demo data for development/testing.
// For production: call /api/admin/clean-db first, then DON'T call seed.

const DRIVERS = [
  {
    phone: "998901111111",
    name: "Akmal",
    rating: 4.7,
    balance: 250000,
    vehicleType: "truck_small",
    vehiclePlate: "01A123BC",
  },
  {
    phone: "998901111112",
    name: "Bekzod",
    rating: 4.9,
    balance: 480000,
    vehicleType: "van",
    vehiclePlate: "02B456CD",
  },
  {
    phone: "998901111113",
    name: "Sardor",
    rating: 4.8,
    balance: 310000,
    vehicleType: "truck_medium",
    vehiclePlate: "01C789DE",
  },
];

const CUSTOMER = {
  phone: "998902222222",
  name: "Demo Mijoz",
};

// Tashkent coordinates
const CHORSU = { lat: 41.3284, lng: 69.2395, address: "Chorsu bozori, Toshkent" };
const MINOR = { lat: 41.3656, lng: 69.2856, address: "Minor, Toshkent" };
const TASHKENT_CITY = { lat: 41.3128, lng: 69.2788, address: "Tashkent City, Toshkent" };
const SAMARQAND_DARVOZA = { lat: 41.3114, lng: 69.2403, address: "Samarqand Darvoza, Toshkent" };
const YUNUSOBOD = { lat: 41.3663, lng: 69.2847, address: "Yunusobod, Toshkent" };

export async function POST() {
  try {
    // 1. Demo drivers (user + driver row)
    const driverUserIds: Record<string, string> = {};
    for (const d of DRIVERS) {
      const user = await db.user.upsert({
        where: { phone: d.phone },
        update: { name: d.name, role: "DRIVER" },
        create: {
          phone: d.phone,
          name: d.name,
          role: "DRIVER",
          language: "uz",
        },
      });
      driverUserIds[d.phone] = user.id;
      await db.driver.upsert({
        where: { userId: user.id },
        update: {
          isOnline: true,
          rating: d.rating,
          totalTrips: d.vehicleType === "truck_medium" ? 28 : d.vehicleType === "van" ? 42 : 15,
          trustScore: 88,
          vehicleType: d.vehicleType,
          vehiclePlate: d.vehiclePlate,
          balance: d.balance,
        },
        create: {
          userId: user.id,
          isOnline: true,
          rating: d.rating,
          totalTrips: d.vehicleType === "truck_medium" ? 28 : d.vehicleType === "van" ? 42 : 15,
          trustScore: 88,
          vehicleType: d.vehicleType,
          vehiclePlate: d.vehiclePlate,
          city: "Toshkent",
          balance: d.balance,
        },
      });
    }

    // 2. Demo customer
    await db.user.upsert({
      where: { phone: CUSTOMER.phone },
      update: { name: CUSTOMER.name },
      create: {
        phone: CUSTOMER.phone,
        name: CUSTOMER.name,
        role: "CUSTOMER",
        language: "uz",
      },
    });

    // 3. Five sample orders with varied statuses
    const ordersSeed = [
      {
        id: "seed-order-completed",
        customerPhone: CUSTOMER.phone,
        driverPhone: DRIVERS[0].phone,
        pickup: CHORSU,
        dropoff: MINOR,
        cargoType: "truck_small",
        weightKg: 500,
        priceSom: 45000,
        distanceKm: 5.6,
        durationMin: 18,
        status: "COMPLETED",
        daysAgo: 2,
        review: { rating: 5, onTime: 5, cargoSafe: 5, polite: 5 },
        earnings: true,
      },
      {
        id: "seed-order-delivered",
        customerPhone: CUSTOMER.phone,
        driverPhone: DRIVERS[1].phone,
        pickup: TASHKENT_CITY,
        dropoff: YUNUSOBOD,
        cargoType: "van",
        weightKg: 900,
        priceSom: 62000,
        distanceKm: 7.1,
        durationMin: 22,
        status: "DELIVERED",
        daysAgo: 1,
        review: null,
        earnings: false,
      },
      {
        id: "seed-order-in-transit",
        customerPhone: CUSTOMER.phone,
        driverPhone: DRIVERS[2].phone,
        pickup: SAMARQAND_DARVOZA,
        dropoff: MINOR,
        cargoType: "truck_medium",
        weightKg: 2500,
        priceSom: 98000,
        distanceKm: 4.8,
        durationMin: 16,
        status: "IN_TRANSIT",
        daysAgo: 0,
        review: null,
        earnings: false,
      },
      {
        id: "seed-order-searching",
        customerPhone: CUSTOMER.phone,
        driverPhone: null,
        pickup: CHORSU,
        dropoff: TASHKENT_CITY,
        cargoType: "pickup",
        weightKg: 300,
        priceSom: 32000,
        distanceKm: 3.4,
        durationMin: 12,
        status: "SEARCHING",
        daysAgo: 0,
        review: null,
        earnings: false,
      },
      {
        id: "seed-order-cancelled",
        customerPhone: CUSTOMER.phone,
        driverPhone: DRIVERS[0].phone,
        pickup: YUNUSOBOD,
        dropoff: CHORSU,
        cargoType: "truck_large",
        weightKg: 8000,
        priceSom: 145000,
        distanceKm: 8.2,
        durationMin: 26,
        status: "CANCELLED",
        daysAgo: 3,
        review: null,
        earnings: false,
      },
    ];

    for (const s of ordersSeed) {
      const createdAt = new Date(Date.now() - s.daysAgo * 86400000);
      const acceptedAt =
        s.status === "SEARCHING" ? null : new Date(createdAt.getTime() + 60_000);
      const pickedUpAt = ["IN_TRANSIT", "DELIVERED", "COMPLETED"].includes(
        s.status
      )
        ? new Date(createdAt.getTime() + 5 * 60_000)
        : null;
      const deliveredAt = ["DELIVERED", "COMPLETED"].includes(s.status)
        ? new Date(createdAt.getTime() + s.durationMin * 60_000)
        : null;

      const order = await db.order.upsert({
        where: { id: s.id },
        update: {
          customerPhone: s.customerPhone,
          driverPhone: s.driverPhone,
          status: s.status,
          cancelReason:
            s.status === "CANCELLED" ? "Mijoz bekor qildi" : null,
        },
        create: {
          id: s.id,
          customerPhone: s.customerPhone,
          driverPhone: s.driverPhone,
          pickupLat: s.pickup.lat,
          pickupLng: s.pickup.lng,
          pickupAddress: s.pickup.address,
          dropoffLat: s.dropoff.lat,
          dropoffLng: s.dropoff.lng,
          dropoffAddress: s.dropoff.address,
          cargoType: s.cargoType,
          weightKg: s.weightKg,
          note: null,
          priceSom: s.priceSom,
          distanceKm: s.distanceKm,
          durationMin: s.durationMin,
          status: s.status,
          cancelReason:
            s.status === "CANCELLED" ? "Mijoz bekor qildi" : null,
          createdAt,
          acceptedAt,
          pickedUpAt,
          deliveredAt,
        },
      });

      // Idempotent history: delete + recreate to avoid dupes
      await db.orderStatusHistory.deleteMany({ where: { orderId: order.id } });
      await db.orderStatusHistory.create({
        data: { orderId: order.id, status: "SEARCHING", note: "Buyurtma yaratildi", createdAt },
      });
      if (s.driverPhone) {
        await db.orderStatusHistory.create({
          data: {
            orderId: order.id,
            status: "ACCEPTED",
            note: "Haydovchi tayinlandi",
            createdAt: acceptedAt ?? createdAt,
          },
        });
      }
      if (["IN_TRANSIT", "DELIVERED", "COMPLETED"].includes(s.status)) {
        await db.orderStatusHistory.create({
          data: { orderId: order.id, status: "LOADED", note: "Yuk yuklandi", createdAt: pickedUpAt ?? createdAt },
        });
        await db.orderStatusHistory.create({
          data: { orderId: order.id, status: "IN_TRANSIT", note: "Yo'lda", createdAt: pickedUpAt ?? createdAt },
        });
      }
      if (["DELIVERED", "COMPLETED"].includes(s.status)) {
        await db.orderStatusHistory.create({
          data: { orderId: order.id, status: "DELIVERED", note: "Yetkazib berildi", createdAt: deliveredAt ?? createdAt },
        });
      }
      if (s.status === "COMPLETED") {
        await db.orderStatusHistory.create({
          data: { orderId: order.id, status: "COMPLETED", note: "Buyurtma yakunlandi", createdAt: deliveredAt ?? createdAt },
        });
      }
      if (s.status === "CANCELLED") {
        await db.orderStatusHistory.create({
          data: { orderId: order.id, status: "CANCELLED", note: "Mijoz bekor qildi", createdAt: createdAt },
        });
      }

      // EarningsEvent for COMPLETED
      if (s.earnings && s.driverPhone) {
        const driverUser = await db.user.findUnique({
          where: { phone: s.driverPhone },
          include: { driver: true },
        });
        if (driverUser?.driver) {
          await db.earningsEvent.deleteMany({
            where: { orderId: order.id },
          });
          await db.earningsEvent.create({
            data: {
              driverId: driverUser.driver.id,
              orderId: order.id,
              amount: Math.round(s.priceSom * 0.8),
              createdAt: deliveredAt ?? createdAt,
            },
          });
        }
      }

      // Review for COMPLETED
      if (s.review) {
        await db.review.deleteMany({ where: { orderId: order.id } });
        await db.review.create({
          data: {
            orderId: order.id,
            reviewerPhone: CUSTOMER.phone,
            rating: s.review.rating,
            onTime: s.review.onTime,
            cargoSafe: s.review.cargoSafe,
            polite: s.review.polite,
            comment: "Zo'r xizmat, rahmat!",
            createdAt: deliveredAt ?? createdAt,
          },
        });
      }
    }

    return NextResponse.json({
      ok: true,
      data: { drivers: DRIVERS.length, orders: ordersSeed.length },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
