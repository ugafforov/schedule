import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/use-auth";
import { loginSchema, type LoginRequest } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, KeyRound, Eye, EyeOff } from "lucide-react";

export function LoginForm() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginRequest) => {
    try {
      setError(null);
      await login(data);
      setLocation("/");
    } catch (err: any) {
      setError("Kirish kodi noto'g'ri. Iltimos, qayta urinib ko'ring.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {error && (
        <Alert variant="destructive" className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-700">{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="accessCode" className="text-gray-700 font-medium">Kirish kodi</Label>
        <div className="relative">
          <KeyRound className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            id="accessCode"
            type={showCode ? "text" : "password"}
            placeholder="Kirish kodingizni kiriting"
            autoComplete="current-password"
            {...register("accessCode")}
            className="pl-10 pr-10 h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => setShowCode(!showCode)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.accessCode && (
          <p className="text-sm text-red-600">{errors.accessCode.message}</p>
        )}
      </div>

      <Button
        type="submit"
        className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm"
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

      <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
        <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Demo kirish kodlari</p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Administrator:</span>
            <code className="text-xs bg-white border border-gray-200 px-2 py-0.5 rounded font-mono text-blue-700">ADMIN2024</code>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">O'qituvchi:</span>
            <code className="text-xs bg-white border border-gray-200 px-2 py-0.5 rounded font-mono text-green-700">TEACHER001</code>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Maktab:</span>
            <code className="text-xs bg-white border border-gray-200 px-2 py-0.5 rounded font-mono text-purple-700">SCHOOL123</code>
          </div>
        </div>
      </div>
    </form>
  );
}
