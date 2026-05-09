import { createMiddleware } from "hono/factory";
import { createClient } from "@supabase/supabase-js";
import { db } from "../db";
import { userRoles } from "@shared/schema";
import { eq } from "drizzle-orm";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("[auth] VITE_SUPABASE_URL yoki SUPABASE_SERVICE_ROLE_KEY topilmadi!");
}

// Server-side Supabase client — foydalanuvchi tokenini verify qilish uchun
const supabase = createClient(supabaseUrl!, supabaseServiceKey!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.split(" ")[1];

  if (!token || token === "null" || token === "undefined") {
    return c.json({ message: "Avtorizatsiya talab etiladi" }, 401);
  }

  try {
    // Supabase access token ni verify qilish
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return c.json({ message: "Yaroqsiz token. Qayta kiring." }, 403);
    }

    const user = data.user;
    const meta = user.user_metadata || {};

    // DB dan rolini olish
    let roleData = await db
      .select()
      .from(userRoles)
      .where(eq(userRoles.userId, user.id))
      .limit(1)
      .then((res) => res[0]);

    // Agar DB da roli bo'lmasa (yangi foydalanuvchi), avtomatik "teacher" roli beramiz
    if (!roleData) {
      const [newRole] = await db
        .insert(userRoles)
        .values({
          userId: user.id,
          role: "teacher",
        })
        .returning();
      roleData = newRole;
    }

    c.set("user", {
      id: user.id,
      email: user.email,
      role: roleData.role,
      firstName: meta.first_name || meta.firstName || "",
      lastName: meta.last_name || meta.lastName || "",
    });

    return next();
  } catch (err: any) {
    console.error("[auth] Token verify xatosi:", err?.message || err);
    return c.json({ message: "Auth server xatosi" }, 500);
  }
});
