import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

const DAYS = [1, 2, 3, 4, 5]; // Mon-Fri
const PERIODS = [
  { num: 1, start: "08:00:00", end: "08:45:00" },
  { num: 2, start: "08:50:00", end: "09:35:00" },
  { num: 3, start: "09:45:00", end: "10:30:00" },
  { num: 4, start: "10:40:00", end: "11:25:00" },
  { num: 5, start: "11:35:00", end: "12:20:00" },
  { num: 6, start: "12:30:00", end: "13:15:00" },
  { num: 7, start: "13:20:00", end: "14:05:00" },
];

async function seedTimeSlots() {
  console.log("Seeding time slots...");
  const slots = [];
  for (const day of DAYS) {
    for (const period of PERIODS) {
      slots.push({
        name: `${period.num}-dars`,
        day_of_week: day,
        period_number: period.num,
        start_time: period.start,
        end_time: period.end,
        is_break: false,
        is_active: true
      });
    }
  }

  await supabase.from('time_slots').delete().neq('id', 0); // Clear existing
  const { error } = await supabase.from('time_slots').insert(slots);
  if (error) {
    console.error("Error seeding time slots:", error);
  } else {
    console.log("Successfully seeded time slots.");
  }
}

seedTimeSlots();
