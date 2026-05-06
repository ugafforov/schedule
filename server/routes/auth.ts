import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";

// Auth endpointlari Supabase ga o'tkazildi.
// Login/logout/register → to'g'ridan-to'g'ri frontend da supabase.auth.* orqali
// Server faqat /api/auth/me ni qo'llab-quvvatlaydi (token tekshirish uchun)

type Variables = {
  user: {
    id: string;
    email: string;
    role: string;
    firstName: string;
    lastName: string;
  };
};

export const authRoutes = new Hono<{ Variables: Variables }>()

  // Foydalanuvchi profilini qaytarish — token valid bo'lsa
  .get("/me", authMiddleware, (c) => {
    const user = c.get("user");
    return c.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      role: user.role || "teacher",
    });
  });
