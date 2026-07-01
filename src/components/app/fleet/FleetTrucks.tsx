"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Truck,
  Search,
  Plus,
  X,
  Loader2,
  MapPin,
  Gauge,
  Check,
  AlertCircle,
  Wrench,
  ChevronRight,
  Edit3,
  Trash2,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { api } from "@/lib/api";
import { ScreenHeader } from "../ScreenHeader";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type TruckStatus = "active" | "maintenance" | "idle" | "retired";

interface FleetTruck {
  id: string;
  plate: string;
  type: string;
  status: TruckStatus;
  make: string;
  year: number;
  driverName: string | null;
  driverPhone: string | null;
  lastTripDate: string | null;
  totalTrips: number;
  mileageKm: number;
}

export function FleetTrucks() {
  const { language } = useApp();
  const [trucks, setTrucks] = useState<FleetTruck[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TruckStatus>("all");
  const [showAddModal, setShowAddModal] = useState(false);

  // Add form state
  const [formPlate, setFormPlate] = useState("");
  const [formType, setFormType] = useState("truck_small");
  const [formMake, setFormMake] = useState("");
  const [formYear, setFormYear] = useState("2020");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadTrucks();
  }, []);

  async function loadTrucks() {
    try {
      const r = await api<{ ok: boolean; data: FleetTruck[] }>("/api/fleet/trucks");
      setTrucks(r.data);
    } catch {
      setTrucks([
        { id: "t1", plate: "01 A 777 AA", type: "truck_medium", status: "active", make: "Isuzu NQR", year: 2021, driverName: "Sardor Karimov", driverPhone: "998911112233", lastTripDate: new Date().toISOString(), totalTrips: 234, mileageKm: 85000 },
        { id: "t2", plate: "10 K 123 CA", type: "truck_small", status: "active", make: "Hyundai HD78", year: 2022, driverName: "Bobur Toshmatov", driverPhone: "998912233445", lastTripDate: new Date().toISOString(), totalTrips: 156, mileageKm: 52000 },
        { id: "t3", plate: "30 B 456 FA", type: "truck_large", status: "maintenance", make: "MAN TGS", year: 2019, driverName: null, driverPhone: null, lastTripDate: new Date(Date.now() - 7 * 86400000).toISOString(), totalTrips: 412, mileageKm: 156000 },
        { id: "t4", plate: "50 C 789 GA", type: "pickup", status: "active", make: "Toyota Hilux", year: 2023, driverName: "Doston Rahimov", driverPhone: "998914455667", lastTripDate: new Date().toISOString(), totalTrips: 89, mileageKm: 28000 },
        { id: "t5", plate: "70 D 321 DA", type: "van", status: "idle", make: "Fuso Canter", year: 2020, driverName: null, driverPhone: null, lastTripDate: new Date(Date.now() - 14 * 86400000).toISOString(), totalTrips: 198, mileageKm: 98000 },
        { id: "t6", plate: "01 E 654 HA", type: "truck_medium", status: "active", make: "Hino 500", year: 2021, driverName: "Sherzod Xolmatov", driverPhone: "998916677889", lastTripDate: new Date().toISOString(), totalTrips: 145, mileageKm: 67000 },
        { id: "t7", plate: "30 F 987 JA", type: "truck_large", status: "retired", make: "Scania R400", year: 2015, driverName: null, driverPhone: null, lastTripDate: new Date(Date.now() - 60 * 86400000).toISOString(), totalTrips: 890, mileageKm: 320000 },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function addTruck() {
    if (!formPlate.trim()) {
      toast.error(t(language, "plateRequired"));
      return;
    }
    setAdding(true);
    try {
      await api("/api/fleet/trucks", {
        method: "POST",
        body: JSON.stringify({
          plate: formPlate.trim(),
          type: formType,
          make: formMake.trim(),
          year: parseInt(formYear),
        }),
      });
      toast.success(t(language, "truckAdded"));
      setShowAddModal(false);
      setFormPlate("");
      setFormMake("");
      setFormYear("2020");
      loadTrucks();
    } catch {
      toast.error(t(language, "error"));
    } finally {
      setAdding(false);
    }
  }

  async function removeTruck(id: string) {
    try {
      await api(`/api/fleet/trucks/${id}`, { method: "DELETE" });
      toast.success(t(language, "truckRemoved"));
      loadTrucks();
    } catch {
      toast.error(t(language, "error"));
    }
  }

  const filtered = trucks.filter((tr) => {
    if (statusFilter !== "all" && tr.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return tr.plate.toLowerCase().includes(q) || tr.make.toLowerCase().includes(q) || tr.driverName?.toLowerCase().includes(q);
    }
    return true;
  });

  const statusCounts = {
    active: trucks.filter((t) => t.status === "active").length,
    maintenance: trucks.filter((t) => t.status === "maintenance").length,
    idle: trucks.filter((t) => t.status === "idle").length,
    retired: trucks.filter((t) => t.status === "retired").length,
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader
        title={t(language, "fleetTrucks")}
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
        {/* Status Summary */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          {(["active", "maintenance", "idle", "retired"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s === statusFilter ? "all" : s)}
              className={cn(
                "flex flex-col items-center rounded-xl p-2.5 transition",
                statusFilter === s ? "bg-primary/10 ring-1 ring-primary/30" : "bg-card ring-1 ring-border/60"
              )}
            >
              <StatusIcon status={s} />
              <span className="mt-1 text-[14px] font-black text-foreground">{statusCounts[s]}</span>
              <span className="text-[9px] text-muted-foreground">{t(language, s as "active" | "maintenance" | "idle" | "retired")}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="mt-3 relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t(language, "searchTrucks")}
            className="h-11 w-full rounded-xl bg-card pl-9 pr-4 text-[14px] text-foreground ring-1 ring-border/70 outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Truck List */}
        {loading ? (
          <div className="mt-8 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            {filtered.map((truck) => (
              <TruckCard
                key={truck.id}
                truck={truck}
                language={language}
                onRemove={() => removeTruck(truck.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Truck Modal */}
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
              <h2 className="text-lg font-bold text-foreground">{t(language, "addNewTruck")}</h2>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-muted-foreground">{t(language, "vehiclePlate")}</label>
                  <input
                    value={formPlate}
                    onChange={(e) => setFormPlate(e.target.value)}
                    placeholder="01 A 777 AA"
                    className="h-12 w-full rounded-xl bg-card px-4 text-[15px] text-foreground ring-1 ring-border/70 outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[12px] font-medium text-muted-foreground">{t(language, "vehicleType")}</label>
                    <select
                      value={formType}
                      onChange={(e) => setFormType(e.target.value)}
                      className="h-12 w-full rounded-xl bg-card px-3 text-[15px] text-foreground ring-1 ring-border/70 outline-none focus:ring-2 focus:ring-primary"
                    >
                      {["pickup", "van", "truck_small", "truck_medium", "truck_large"].map((v) => (
                        <option key={v} value={v}>{vehicleLabel(v)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[12px] font-medium text-muted-foreground">{t(language, "year")}</label>
                    <input
                      value={formYear}
                      onChange={(e) => setFormYear(e.target.value)}
                      type="number"
                      className="h-12 w-full rounded-xl bg-card px-3 text-[15px] text-foreground ring-1 ring-border/70 outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-muted-foreground">{t(language, "makeModel")}</label>
                  <input
                    value={formMake}
                    onChange={(e) => setFormMake(e.target.value)}
                    placeholder="Isuzu NQR"
                    className="h-12 w-full rounded-xl bg-card px-4 text-[15px] text-foreground ring-1 ring-border/70 outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <button
                  onClick={addTruck}
                  disabled={adding}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-bold text-primary-foreground transition active:scale-[0.98] disabled:opacity-50"
                >
                  {adding ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                  {t(language, "addTruck")}
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

function StatusIcon({ status }: { status: TruckStatus }) {
  switch (status) {
    case "active":
      return <Check className="h-4 w-4 text-emerald-500" />;
    case "maintenance":
      return <Wrench className="h-4 w-4 text-amber-500" />;
    case "idle":
      return <Truck className="h-4 w-4 text-muted-foreground" />;
    case "retired":
      return <AlertCircle className="h-4 w-4 text-destructive" />;
  }
}

function TruckCard({ truck, language, onRemove }: {
  truck: FleetTruck;
  language: "uz" | "ru" | "en";
  onRemove: () => void;
}) {
  const statusColors: Record<TruckStatus, string> = {
    active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    maintenance: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    idle: "bg-muted text-muted-foreground",
    retired: "bg-destructive/10 text-destructive",
  };
  const statusLabels: Record<TruckStatus, string> = {
    active: t(language, "active"),
    maintenance: t(language, "maintenance"),
    idle: t(language, "idle"),
    retired: t(language, "retired"),
  };

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      className="rounded-2xl bg-card p-3.5 ring-1 ring-border/60"
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl",
          truck.status === "active" ? "bg-emerald-500/10" : truck.status === "maintenance" ? "bg-amber-500/10" : "bg-muted"
        )}>
          {truck.type === "pickup" ? "🛻" : truck.type === "van" ? "🚐" : "🚚"}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-bold text-foreground">{truck.plate}</span>
            <button onClick={onRemove} className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:text-destructive transition">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-0.5 text-[12px] text-muted-foreground">
            {truck.make} · {truck.year}
          </div>

          <div className="mt-1.5 flex items-center gap-2">
            <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-semibold", statusColors[truck.status])}>
              {statusLabels[truck.status]}
            </span>
            <span className="text-[11px] text-muted-foreground">{vehicleLabel(truck.type)}</span>
          </div>

          {truck.driverName && (
            <div className="mt-1.5 text-[12px] text-muted-foreground">
              {t(language, "assignedTo")}: <span className="font-medium text-foreground">{truck.driverName}</span>
            </div>
          )}

          <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-0.5">
              <Gauge className="h-3 w-3" />
              {truck.mileageKm.toLocaleString()} km
            </span>
            <span>{truck.totalTrips} {t(language, "trips")}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function vehicleLabel(v: string): string {
  const map: Record<string, string> = {
    pickup: "Pickup",
    van: "Van",
    truck_small: "Kichik yuk",
    truck_medium: "O'rta yuk",
    truck_large: "Katta yuk",
  };
  return map[v] || v;
}
