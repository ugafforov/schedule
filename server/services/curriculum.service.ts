/**
 * O'quv reja bo'yicha fan ixtisosligini aniqlash
 * Bu funksiya routes ichida emas, alohida service da
 */
export function getSpecialty(subjectName: string, grade: string): string {
  const name = subjectName.toLowerCase().trim();
  const g = parseInt(grade);

  // Boshlang'ich sinflar (1-4)
  if (g >= 1 && g <= 4) {
    const primary = [
      "ona tili", "o'qish savodxonligi", "matematika",
      "tarbiya", "tabiiy fanlar (science)", "tasviriy san'at", "texnologiya",
    ];
    if (primary.includes(name)) return "Boshlang'ich sinf o'qituvchisi";
  }

  if (["matematika", "algebra", "geometriya"].includes(name)) return "Matematika";
  if (["iqtisodiy bilim asoslari", "tadbirkorlik asoslari"].includes(name)) return "Iqtisod va tadbirkorlik";
  if (["biologiya", "tabiiy fanlar (science)"].includes(name)) return "Biologiya va Tabiiy fanlar";
  if (["ona tili", "adabiyot"].includes(name)) return "Ona tili va adabiyot";
  if (["tarix", "o'zbekiston tarixi", "jahon tarixi", "tarixdan hikoyalar", "qadimgi dunyo tarixi"].includes(name)) return "Tarix";
  if (["davlat va huquq asoslari", "tarbiya"].includes(name)) return "Huquq va tarbiya";
  if (["ingliz tili", "nemis tili", "fransuz tili", "chet tili"].includes(name)) return "Chet tili";
  if (["fizika", "astronomiya"].includes(name)) return "Fizika va astronomiya";
  if (["kimyo"].includes(name)) return "Kimyo";
  if (["geografiya"].includes(name)) return "Geografiya";
  if (["informatika va axborot texnologiyalari"].includes(name)) return "Informatika";
  if (["musiqa madaniyati"].includes(name)) return "Musiqa";
  if (["jismoniy tarbiya"].includes(name)) return "Jismoniy tarbiya";
  if (["rus tili"].includes(name)) return "Rus tili";

  return subjectName.charAt(0).toUpperCase() + subjectName.slice(1);
}
