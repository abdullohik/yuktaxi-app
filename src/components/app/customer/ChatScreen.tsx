"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Phone, MessageSquare, Loader2, ChevronLeft } from "lucide-react";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { api } from "@/lib/api";
import { formatClock } from "@/lib/format";
import { useSocket } from "@/hooks/use-socket";
import { BrandLogo } from "../BrandLogo";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types";

export function ChatScreen() {
  const { language, activeOrderId, user, back, navigate } = useApp();
  const { join, on, emit, connected } = useSocket();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [orderTitle, setOrderTitle] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const orderIdRef = useRef<string | null>(null);

  // No active order -> show a friendly empty state
  useEffect(() => {
    if (!activeOrderId) { setLoading(false); return; }
    orderIdRef.current = activeOrderId;
    setLoading(true);
    api<{ ok: boolean; data: ChatMessage[] }>(`/api/orders/${activeOrderId}/chat`)
      .then((r) => setMessages(r.data ?? []))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
    // also fetch order title
    api<{ ok: boolean; data: { id: string; driverName: string | null; customerName: string | null; status: string } }>(`/api/orders/${activeOrderId}`)
      .then((r) => {
        const other = user?.role === "DRIVER" ? r.data.customerName : r.data.driverName;
        setOrderTitle(other ?? t(language, "interlocutor"));
      })
      .catch(() => setOrderTitle(t(language, "interlocutor")));
    join(`order:${activeOrderId}`);
  }, [activeOrderId, user?.role, join]);

  // socket: receive new messages
  useEffect(() => {
    if (!activeOrderId) return;
    const off = on("chat:message", (payload: unknown) => {
      const m = payload as ChatMessage;
      if (m.orderId === orderIdRef.current) {
        setMessages((prev) => (prev.find((x) => x.id === m.id) ? prev : [...prev, m]));
      }
    });
    return () => { off(); };
  }, [activeOrderId, connected]);

  // auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    if (!text.trim() || !activeOrderId || !user) return;
    const content = text.trim();
    setText("");
    setSending(true);
    try {
      const r = await api<{ ok: boolean; data: ChatMessage }>(`/api/orders/${activeOrderId}/chat`, {
        method: "POST",
        body: JSON.stringify({
          senderPhone: user.phone,
          senderRole: user.role === "DRIVER" ? "DRIVER" : "CUSTOMER",
          text: content,
        }),
      });
      setMessages((prev) => (prev.find((x) => x.id === r.data.id) ? prev : [...prev, r.data]));
      emit("chat:message", r.data);
    } catch {
      toast(t(language, "messageSendFailed"), "error");
      setText(content);
    } finally {
      setSending(false);
    }
  }

  // toast helper (inline to avoid extra import churn)
  function toast(msg: string, _kind: "error" | "info") {
    if (typeof window !== "undefined") {
      import("sonner").then(({ toast: s }) => s.error(msg));
    }
  }

  if (!activeOrderId) {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="safe-top flex items-center gap-2 border-b border-border/50 px-4 py-4">
          <button onClick={back} className="grid h-10 w-10 place-items-center rounded-full bg-card ring-1 ring-border/70 active:scale-95">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <BrandLogo size={28} showText={false} />
          <h1 className="text-lg font-bold text-foreground">{t(language, "chat")}</h1>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <div className="relative grid h-24 w-24 place-items-center">
            <div className="absolute inset-0 rounded-full bg-primary/5" />
            <div className="relative grid h-14 w-14 place-items-center rounded-full bg-primary/15 text-primary">
              <MessageSquare className="h-7 w-7" />
            </div>
          </div>
          <h3 className="mt-5 text-lg font-bold text-foreground">{t(language, "noActiveChat")}</h3>
          <p className="mt-1.5 max-w-xs text-[15px] text-muted-foreground">
            {t(language, "noActiveChatDesc")}
          </p>
          <button
            onClick={() => navigate("orders")}
            className="mt-5 h-12 rounded-xl bg-primary px-6 text-[15px] font-semibold text-primary-foreground"
          >
            {t(language, "orders")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* header */}
      <div className="safe-top shrink-0 border-b border-border/50 bg-card/90 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <button onClick={back} className="grid h-10 w-10 place-items-center rounded-full bg-background ring-1 ring-border/70 active:scale-95">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-primary to-amber-700 text-lg text-white shadow-md">
            {user?.role === "DRIVER" ? "👤" : "🚚"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[16px] font-bold text-foreground">{orderTitle || "..."}</div>
            <div className="flex items-center gap-1.5 text-[12px] text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {connected ? t(language, "online") : t(language, "connecting")}
            </div>
          </div>
          <a href="tel:+998901234567" className="grid h-11 w-11 place-items-center rounded-full bg-emerald-500 text-white active:scale-95">
            <Phone className="h-5 w-5" />
          </a>
        </div>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="yt-scroll flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="mx-auto w-fit rounded-full bg-muted px-3 py-1 text-[12px] text-muted-foreground">
              {messages.length > 0 ? t(language, "chatEncrypted") : t(language, "writeFirstMessage")}
            </div>
            <AnimatePresence initial={false}>
              {messages.map((m) => {
                const mine = m.senderPhone === user?.phone;
                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={cn("flex", mine ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[78%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-snug shadow-sm",
                        mine
                          ? "rounded-br-md bg-primary text-primary-foreground"
                          : "rounded-bl-md bg-card text-foreground ring-1 ring-border/60"
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      <div className={cn("mt-1 text-[11px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                        {formatClock(m.createdAt)}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* composer */}
      <div className="safe-bottom shrink-0 border-t border-border/50 bg-card px-3 py-2.5">
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={t(language, "writeMessage")}
            rows={1}
            className="max-h-24 min-h-[44px] flex-1 resize-none rounded-2xl bg-background px-3.5 py-3 text-[15px] text-foreground ring-1 ring-border/70 outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={send}
            disabled={!text.trim() || sending}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-md transition active:scale-95 disabled:opacity-40"
          >
            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
