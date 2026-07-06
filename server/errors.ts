// Domen xatolari (foydalanuvchi xatosi — validatsiya, mavjud emaslik va h.k.) uchun.
// Global error handler (server/index.ts) `err.status`ni o'qiydi va shunga mos status
// kod bilan javob qaytaradi — oddiy `Error` esa har doim 500 (server xatosi) sifatida
// ko'rsatilib, haqiqiy server nosozligidan farqlanmay qolar edi.
export class DomainError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "DomainError";
    this.status = status;
  }
}
