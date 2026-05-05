import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { LoginForm } from "@/components/forms/login-form";
import { School, Calendar, Users, BookOpen } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    if (user) setLocation("/");
  }, [user, setLocation]);

  if (user) return null;

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900">
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
            <School className="h-6 w-6 text-white" />
          </div>
          <span className="text-white font-bold text-lg">Maktab Dars Jadvali</span>
        </div>

        <div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Maktab jadvalini<br />
            <span className="text-blue-400">oson boshqaring</span>
          </h1>
          <p className="text-slate-400 text-lg mb-12">
            Avtomatik jadval yaratish, o'qituvchi va xona boshqarish — barchasi bir joyda.
          </p>

          <div className="space-y-6">
            {[
              { icon: Calendar, color: "bg-blue-500/20 text-blue-400", title: "Avtomatik jadval", desc: "Bir tugma bilan to'liq haftalik dars jadvalini yarating" },
              { icon: Users, color: "bg-green-500/20 text-green-400", title: "O'qituvchi boshqaruvi", desc: "O'qituvchilar va ularning dars yuklamasini kuzatib boring" },
              { icon: BookOpen, color: "bg-purple-500/20 text-purple-400", title: "Ziddiyatsiz jadval", desc: "Xona va o'qituvchi ziddiyatlarini avtomatik aniqlang" },
            ].map(({ icon: Icon, color, title, desc }) => (
              <div key={title} className="flex items-start space-x-4">
                <div className={`w-10 h-10 ${color.split(" ")[0]} rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <Icon className={`h-5 w-5 ${color.split(" ")[1]}`} />
                </div>
                <div>
                  <h3 className="text-white font-semibold">{title}</h3>
                  <p className="text-slate-400 text-sm mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-slate-600 text-sm">© 2024 Maktab Dars Jadvali tizimi</div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="text-center mb-8">
              <div className="mx-auto w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                <School className="h-7 w-7 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Kirish</h2>
              <p className="text-gray-500 text-sm mt-1">Tizimga kirish uchun kodingizni kiriting</p>
            </div>
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  );
}
