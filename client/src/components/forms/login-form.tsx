import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail, Eye, EyeOff, Lock } from "lucide-react";
import { loginSchema, type LoginRequest as LoginFormData } from "@shared/schema";

export function LoginForm() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [lastAttempt, setLastAttempt] = useState<number>(0);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      // Rate limiting: 3 soniya kutish
      const now = Date.now();
      if (now - lastAttempt < 3000) {
        setError("Juda tez urinyapsiz. Iltimos, 3 soniya kuting.");
        return;
      }
      setLastAttempt(now);
      setError(null);
      await login(data.email, data.password);
      setLocation("/");
    } catch (err: any) {
      // Supabase xato xabarlarini o'zbekchaga tarjima qilish
      const msg: string = err.message || "";
      if (msg.includes("Invalid login credentials")) {
        setError("Email yoki parol noto'g'ri.");
      } else if (msg.includes("Email not confirmed")) {
        setError("Email tasdiqlanmagan. Pochtangizni tekshiring.");
      } else if (msg.includes("Too many requests")) {
        setError("Juda ko'p urinish. Biroz kuting.");
      } else {
        setError(msg || "Kirishda xatolik yuz berdi.");
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {error && (
        <Alert variant="destructive" className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-700">{error}</AlertDescription>
        </Alert>
      )}

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="email" className="text-foreground font-medium">
          Email
        </Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            id="email"
            type="email"
            placeholder="email@maktab.uz"
            autoComplete="email"
            {...register("email")}
            className="pl-10 h-11 border-border focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        {errors.email && (
          <p className="text-sm text-red-600">{errors.email.message}</p>
        )}
      </div>

      {/* Parol */}
      <div className="space-y-2">
        <Label htmlFor="password" className="text-foreground font-medium">
          Parol
        </Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="Parolingizni kiriting"
            autoComplete="current-password"
            {...register("password")}
            className="pl-10 pr-10 h-11 border-border focus:border-blue-500 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && (
          <p className="text-sm text-red-600">{errors.password.message}</p>
        )}
      </div>

      <Button
        type="submit"
        className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg shadow-sm"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Kirilmoqda...
          </>
        ) : (
          "Kirish"
        )}
      </Button>
    </form>
  );
}
