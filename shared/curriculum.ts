import { isPrimaryTeacherAllowedSubject } from "./constants";
import { DTS_CURRICULUM_2026, RUSSIAN_DTS_CURRICULUM_2026 } from "./dts-curriculum";

function buildCurriculumMap(dtsEntries: typeof DTS_CURRICULUM_2026): Record<string, Record<string, number>> {
  const map: Record<string, Record<string, number>> = {};
  for (const entry of dtsEntries) {
    for (const [gradeStr, hours] of Object.entries(entry.hours)) {
      if (!map[gradeStr]) {
        map[gradeStr] = {};
      }
      map[gradeStr][entry.name] = hours;
    }
  }
  return map;
}

export const UZBEK_CURRICULUM: Record<string, Record<string, number>> = buildCurriculumMap(DTS_CURRICULUM_2026);
export const RUSSIAN_CURRICULUM: Record<string, Record<string, number>> = buildCurriculumMap(RUSSIAN_DTS_CURRICULUM_2026);

export function getSpecialty(subjectName: string, grade: string, language: string = "uz"): string {
  const name = subjectName.toLowerCase().trim();
  const g = parseInt(grade);

  if (g >= 1 && g <= 4) {
    if (isPrimaryTeacherAllowedSubject(name)) return "Boshlang'ich sinf o'qituvchisi";
  }

  if (language === "ru") {
    if (["ona tili", "adabiyot", "rus tili"].includes(name)) return "Rus tili";
    if (["o'zbek tili"].includes(name)) return "O'zbek tili";
  } else {
    if (["ona tili", "adabiyot"].includes(name)) return "Ona tili va adabiyot";
    if (["rus tili"].includes(name)) return "Rus tili";
    if (["o'zbek tili"].includes(name)) return "O'zbek tili";
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

