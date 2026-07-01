"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Phone, Headphones, Loader2, ChevronLeft, Sparkles, Check,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { api } from "@/lib/api";
import { formatClock } from "@/lib/format";
import { BrandLogo } from "../BrandLogo";
import { cn } from "@/lib/utils";

interface SupportMessage {
  id: string;
  userPhone: string;
  role: "CUSTOMER" | "SUPPORT";
  text: string;
  createdAt: string;
}

export function SupportChatScreen() {
  const { language, user, isGuest, back, navigate } = useApp();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const phone = user?.phone ?? "guest";
  const guestName = isGuest ? t(language, "guest") : user?.name ?? t(language, "interlocutor");

  useEffect(() => {
    setLoading(true);
    api<{ ok: boolean; data: SupportMessage[] }>(`/api/support/chat?phone=${phone}&lang=${language}`)
      .then((r) => setMessages(r.data ?? []))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [phone, language]);

  // auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    if (!text.trim() || sending) return;
    const content = text.trim();
    setText("");
    setSending(true);

    // Optimistic: show user message immediately
    const optimistic: SupportMessage = {
      id: `pending_${Date.now()}`,
      userPhone: phone,
      role: "CUSTOMER",
      text: content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const r = await api<{ ok: boolean; data: { userMessage: SupportMessage; reply: SupportMessage } }>(
        "/api/support/chat",
        {
          method: "POST",
          body: JSON.stringify({ phone, text: content, role: "CUSTOMER", lang: language }),
        }
      );
      // Replace optimistic with real messages
      setMessages((prev) => {
        const withoutOptimistic = prev.filter((m) => m.id !== optimistic.id);
        return [...withoutOptimistic, r.data.userMessage, r.data.reply];
      });
    } catch {
      // If failed, keep optimistic but mark as error
      setText(content);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="safe-top shrink-0 border-b border-border/50 bg-card/90 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <button onClick={back} className="grid h-10 w-10 place-items-center rounded-full bg-background ring-1 ring-border/70 active:scale-95">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-primary to-amber-700 text-white shadow-md">
            <Headphones className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[16px] font-bold text-foreground">{t(language, "supportCenter")}</div>
            <div className="flex items-center gap-1.5 text-[12px] text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {t(language, "online")}
            </div>
          </div>
          <a href="tel:+998901234567" className="grid h-11 w-11 place-items-center rounded-full bg-emerald-500 text-white active:scale-95">
            <Phone className="h-5 w-5" />
          </a>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="yt-scroll flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* AI badge */}
            <div className="mx-auto w-fit rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
              <Sparkles className="mr-1 inline h-3 w-3" />
              {t(language, "supportAiPowered")}
            </div>

            <AnimatePresence initial={false}>
              {messages.map((m) => {
                const mine = m.role === "CUSTOMER";
                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={cn("flex", mine ? "justify-end" : "justify-start")}
                  >
                    <div className={cn(
                      "max-w-[78%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-snug shadow-sm",
                      mine
                        ? "rounded-br-md bg-primary text-primary-foreground"
                        : "rounded-bl-md bg-card text-foreground ring-1 ring-border/60"
                    )}>
                      {!mine && (
                        <div className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold text-primary">
                          <Headphones className="h-3 w-3" />
                          {t(language, "supportAgent")}
                        </div>
                      )}
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      <div className={cn("mt-1 text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                        {formatClock(m.createdAt)}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {sending && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className="rounded-2xl rounded-bl-md bg-card px-4 py-3 ring-1 ring-border/60">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: "0ms" }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: "150ms" }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* Quick suggestions */}
      {messages.length <= 1 && !sending && (
        <div className="shrink-0 px-4 pb-2">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {[
              { key: "supportQPrice", text: t(language, "supportQPrice") },
              { key: "supportQDriver", text: t(language, "supportQDriver") },
              { key: "supportQPayment", text: t(language, "supportQPayment") },
              { key: "supportQPhoto", text: t(language, "supportQPhoto") },
            ].map((q) => (
              <button
                key={q.key}
                onClick={() => { setText(q.text); }}
                className="shrink-0 rounded-full bg-card px-3 py-1.5 text-[12px] font-medium text-foreground ring-1 ring-border/60 active:scale-95"
              >
                {q.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Composer */}
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
