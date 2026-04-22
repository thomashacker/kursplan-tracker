"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Home, User as UserIcon, LogOut } from "lucide-react";

const springSnap = { type: "spring" as const, stiffness: 480, damping: 32 };

function NavButton({
  href,
  onClick,
  active,
  destructive,
  icon,
  label,
}: {
  href?: string;
  onClick?: () => void;
  active?: boolean;
  destructive?: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  const reduced = useReducedMotion();

  const base =
    "inline-flex items-center gap-2 h-10 px-3.5 rounded-xl font-medium text-sm transition-colors select-none";
  const color = destructive
    ? "text-destructive hover:bg-destructive/8"
    : active
    ? "bg-primary/10 text-primary"
    : "text-muted-foreground hover:bg-secondary hover:text-foreground";

  const inner = (
    <>
      <span className="flex-shrink-0">{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </>
  );

  if (href) {
    return (
      <motion.div whileTap={reduced ? {} : { scale: 0.94 }} transition={springSnap}>
        <Link href={href} className={`${base} ${color}`}>
          {inner}
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={reduced ? {} : { scale: 0.94 }}
      transition={springSnap}
      className={`${base} ${color}`}
    >
      {inner}
    </motion.button>
  );
}

export function Navbar({ user }: { user: User }) {
  const router = useRouter();
  const pathname = usePathname();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;
  const fullName = (user.user_metadata?.full_name as string | undefined) ?? "";
  const initials =
    fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "??";

  return (
    <header className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">

        {/* Logo + user identity */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/dashboard"
            className="font-bold text-lg shrink-0"
            style={{ fontFamily: "var(--font-syne, system-ui)" }}
          >
            Kurs.Y
          </Link>
          <span className="hidden md:block text-border">|</span>
          <div className="hidden md:flex items-center gap-2 min-w-0">
            <Avatar className="h-6 w-6 shrink-0">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName} />}
              <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground truncate max-w-[160px]">
              {fullName || user.email}
            </span>
          </div>
        </div>

        {/* Nav actions */}
        <nav className="flex items-center gap-1">
          <NavButton
            href="/dashboard"
            active={pathname === "/dashboard"}
            icon={<Home size={17} />}
            label="Vereine"
          />
          <NavButton
            href="/dashboard/konto"
            active={pathname.startsWith("/dashboard/konto")}
            icon={<UserIcon size={17} />}
            label="Konto"
          />
          <NavButton
            onClick={signOut}
            destructive
            icon={<LogOut size={17} />}
            label="Abmelden"
          />
        </nav>

      </div>
    </header>
  );
}
