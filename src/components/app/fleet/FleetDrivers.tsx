"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Search,
  Phone,
  Star,
  MapPin,
  Clock,
  Power,
  PowerOff,
  ChevronRight,
  Filter,
  Plus,
  X,
  Check,
  Loader2,
  UserPlus,
  Truck,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { api } from "@/lib/api";
import { formatPhone, formatKm } from "@/lib/format";
import { ScreenHeader } from "../ScreenHeader";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface FleetDriver {
  id: string;
  userId: string;
  name: string | null;
  phone: string;
  isOnline: boolean;
  rating: number;
  totalTrips: number;
  trustScore: number;
  vehicleType: string;
  vehiclePlate: string | null;
  city: string;
  balance: number;
  activeOrderCount: number;
}

export function FleetDrivers() {
  const { language } = useApp();
  const [drivers, setDrivers] = useState<FleetDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "online" | "offline">("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDriverPhone, setNewDriverPhone] = useState("");
  const [newDriverName, setNewDriverName] = useState("");
  const [newDriverVehicle, setNewDriverVehicle] = useState("truck_small");
  const [newDriverPlate, setNewDriverPlate] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadDrivers();
  }, []);

  async function loadDrivers() {
    try {
      const r = await api<{ ok: boolean; data: FleetDriver[] }>("/api/fleet/drivers");
      setDrivers(r.data);
    } catch {
      // Demo data
      setDrivers([
        { id: "d1", userId: "u1", name: "Sardor Karimov", phone: "998911112233", isOnline: true, rating: 4.8, totalTrips: 234, trustScore: 92, vehicleType: "truck_medium", vehiclePlate: "01 A 777 AA", city: "Toshkent", balance: 1250000, activeOrderCount: 1 },
        { id: "d2", userId: "u2", name: "Bobur Toshmatov", phone: "998912233445", isOnline: true, rating: 4.5, totalTrips: 156, trustScore: 85, vehicleType: "truck_small", vehiclePlate: "10 K 123 CA", city: "Toshkent", balance: 780000, activeOrderCount: 0 },
        { id: "d3", userId: "u3", name: "Jasur Umarov", phone: "998913344556", isOnline: false, rating: 4.9, totalTrips: 412, trustScore: 96, vehicleType: "truck_large", vehiclePlate: "30 B 456 FA", city: "Toshkent", balance: 2100000, activeOrderCount: 0 },
        { id: "d4", userId: "u4", name: "Doston Rahimov", phone: "998914455667", isOnline: true, rating: 4.2, totalTrips: 89, trustScore: 78, vehicleType: "pickup", vehiclePlate: "50 C 789 GA", city: "Samarqand", balance: 450000, activeOrderCount: 1 },
        { id: "d5", userId: "u5", name: "Laziz Botirov", phone: "998915566778", isOnline: false, rating: 4.7, totalTrips: 198, trustScore: 88, vehicleType: "van", vehiclePlate: "70 D 321 DA", city: "Toshkent", balance: 950000, activeOrderCount: 0 },
        { id: "d6", userId: "u6", name: "Sherzod Xolmatov", phone: "998916677889", isOnline: true, rating: 4.6, totalTrips: 145, trustScore: 84, vehicleType: "truck_medium", vehiclePlate: "01 E 654 HA", city: "Buxoro", balance: 680000, activeOrderCount: 0 },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function toggleOnline(driverId: string, current: boolean) {
    try {
      await api(`/api/fleet/drivers/${driverId}/toggle-online`, {
        method: "POST",
        body: JSON.stringify({ online: !current }),
      });
      setDrivers((prev) =>
        prev.map((d) => (d.id === driverId ? { ...d, isOnline: !current } : d))
      );
      toast.success(current ? t(language, "driverOffline") : t(language, "driverOnline"));
    } catch {
      toast.error(t(language, "error"));
    }
  }

  async function addDriver() {
    if (newDriverPhone.replace(/\D/g, "").length < 9) {
      toast.error(t(language, "phoneRequired"));
      return;
    }
    setAdding(true);
    try {
      await api("/api/fleet/drivers", {
        method: "POST",
        body: JSON.stringify({
          phone: "998" + newDriverPhone.replace(/\D/g, ""),
          name: newDriverName.trim(),
          vehicleType: newDriverVehicle,
          vehiclePlate: newDriverPlate.trim(),
        }),
      });
      toast.success(t(language, "driverAdded"));
      setShowAddModal(false);
      setNewDriverPhone("");
      setNewDriverName("");
      setNewDriverPlate("");
      loadDrivers();
    } catch {
      toast.error(t(language, "error"));
    } finally {
      setAdding(false);
    }
  }

  const filtered = drivers.filter((d) => {
    if (filter === "online" && !d.isOnline) return false;
    if (filter === "offline" && d.isOnline) return false;
    if (search) {
      const q = search.toLowerCase();
      return (d.name?.toLowerCase().includes(q) || d.phone.includes(q) || d.vehiclePlate?.toLowerCase().includes(q));
    }
    return true;
  });

  const onlineCount = drivers.filter((d) => d.isOnline).length;

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader
        title={t(language, "fleetDrivers")}
        right={
          <button
            onClick={() => setShowAddModal(true)}
            className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground transition active:scale-90"
          >
            <Plus className="h-5 w-5" />
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto yt-scroll px-4 pb-6">
        {/* Search + Filter */}
        <div className="mt-4 space-y-2.5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t(language, "searchDrivers")}
              className="h-11 w-full rounded-xl bg-card pl-9 pr-4 text-[14px] text-foreground ring-1 ring-border/70 outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex gap-2">
            {(["all", "online", "offline"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition",
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground ring-1 ring-border/60"
                )}
              >
                {f === "all" ? `${t(language, "all")} (${drivers.length})` :
                 f === "online" ? `${t(language, "online")} (${onlineCount})` :
                 `${t(language, "offline")} (${drivers.length - onlineCount})`}
              </button>
            ))}
          </div>
        </div>

        {/* Driver List */}
        {loading ? (
          <div className="mt-8 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-8 text-center text-[14px] text-muted-foreground">
            {t(language, "noDrivers")}
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            {filtered.map((driver) => (
              <DriverCard
                key={driver.id}
                driver={driver}
                language={language}
                onToggle={() => toggleOnline(driver.id, driver.isOnline)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Driver Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25 }}
              className="w-full rounded-t-3xl bg-background p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
              <h2 className="text-lg font-bold text-foreground">{t(language, "addNewDriver")}</h2>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-muted-foreground">{t(language, "phoneNumber")}</label>
                  <input
                    value={newDriverPhone}
                    onChange={(e) => setNewDriverPhone(e.target.value)}
                    placeholder="90 123 45 67"
                    inputMode="numeric"
                    className="h-12 w-full rounded-xl bg-card px-4 text-[15px] text-foreground ring-1 ring-border/70 outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-muted-foreground">{t(language, "profileName")}</label>
                  <input
                    value={newDriverName}
                    onChange={(e) => setNewDriverName(e.target.value)}
                    placeholder={t(language, "profileNamePlaceholder")}
                    className="h-12 w-full rounded-xl bg-card px-4 text-[15px] text-foreground ring-1 ring-border/70 outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[12px] font-medium text-muted-foreground">{t(language, "vehicleType")}</label>
                    <select
                      value={newDriverVehicle}
                      onChange={(e) => setNewDriverVehicle(e.target.value)}
                      className="h-12 w-full rounded-xl bg-card px-3 text-[15px] text-foreground ring-1 ring-border/70 outline-none focus:ring-2 focus:ring-primary"
                    >
                      {["pickup", "van", "truck_small", "truck_medium", "truck_large"].map((v) => (
                        <option key={v} value={v}>{vehicleLabel(v)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[12px] font-medium text-muted-foreground">{t(language, "vehiclePlate")}</label>
                    <input
                      value={newDriverPlate}
                      onChange={(e) => setNewDriverPlate(e.target.value)}
                      placeholder="01 A 777 AA"
                      className="h-12 w-full rounded-xl bg-card px-3 text-[15px] text-foreground ring-1 ring-border/70 outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <button
                  onClick={addDriver}
                  disabled={adding}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-bold text-primary-foreground transition active:scale-[0.98] disabled:opacity-50"
                >
                  {adding ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
                  {t(language, "addDriver")}
                </button>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="h-11 w-full text-[14px] font-medium text-muted-foreground"
                >
                  {t(language, "cancel")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DriverCard({ driver, language, onToggle }: {
  driver: FleetDriver;
  language: "uz" | "ru" | "en";
  onToggle: () => void;
}) {
  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      className="rounded-2xl bg-card p-3.5 ring-1 ring-border/60"
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className={cn(
          "grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg font-bold text-white",
          driver.isOnline ? "bg-gradient-to-br from-emerald-500 to-teal-600" : "bg-muted text-muted-foreground"
        )}>
          {driver.name?.[0]?.toUpperCase() || "?"}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[14px] font-bold text-foreground">{driver.name || formatPhone(driver.phone)}</span>
              {driver.isOnline && (
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
              )}
            </div>
            <button
              onClick={onToggle}
              className={cn(
                "grid h-8 w-8 place-items-center rounded-lg transition",
                driver.isOnline
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {driver.isOnline ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
            </button>
          </div>

          <div className="mt-1 flex items-center gap-2 text-[12px] text-muted-foreground">
            <span className="rounded-md bg-muted px-1.5 py-0.5">{driver.vehiclePlate || "—"}</span>
            <span>{vehicleLabel(driver.vehicleType)}</span>
          </div>

          <div className="mt-2 flex items-center gap-3 text-[12px]">
            <span className="flex items-center gap-0.5">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {driver.rating.toFixed(1)}
            </span>
            <span className="flex items-center gap-0.5">
              <Clock className="h-3 w-3" />
              {driver.totalTrips} {t(language, "trips")}
            </span>
            <span className="flex items-center gap-0.5">
              <MapPin className="h-3 w-3" />
              {driver.city}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function vehicleLabel(v: string): string {
  const map: Record<string, string> = {
    pickup: "🛻 Pickup",
    van: "🚐 Van",
    truck_small: "🚚 Kichik yuk",
    truck_medium: "🚛 O'rta yuk",
    truck_large: "🚛 Katta yuk",
  };
  return map[v] || v;
}
