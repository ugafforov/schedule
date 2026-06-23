// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
  }

  try {
    const { classIds, clearExisting } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    if (clearExisting) {
      if (classIds?.length) {
        for (const cid of classIds) {
          await supabase.from("schedule_entries").delete().eq("class_id", cid);
        }
      } else {
        await supabase.from("schedule_entries").delete().neq("id", 0);
      }
    }

    const { data: allClasses } = await supabase.from("classes").select("*").eq("is_active", true);
    const { data: allSubjects } = await supabase.from("subjects").select("*").eq("is_active", true);
    const { data: allTeachers } = await supabase.from("teachers").select("*").eq("is_active", true);
    const { data: allClassSubjects } = await supabase.from("class_subjects").select("*");
    const { data: allTimeSlots } = await supabase.from("time_slots").select("*").eq("is_active", true);
    const { data: allRooms } = await supabase.from("rooms").select("*").eq("is_active", true);
    const { data: allUnavailability } = await supabase.from("teacher_unavailability").select("*");

    const targetClasses = classIds?.length
      ? allClasses?.filter((c: any) => classIds.includes(c.id))
      : allClasses;

    const unavailSet = new Set(allUnavailability?.map((u: any) => `${u.teacher_id}_${u.day_of_week}_${u.period_number}`));
    const teacherHoursCount: Record<number, number> = {};
    allTeachers?.forEach((t: any) => { teacherHoursCount[t.id] = 0; });

    const teacherBusy = new Set<string>();
    const roomBusy = new Set<string>();
    const classBusy = new Set<string>();
    const classPerDay = new Map<string, number>();
    const subjectPerDay = new Map<string, number>();

    const slotsByDay: Record<number, any[]> = {};
    allTimeSlots?.forEach((s: any) => {
      if (!s.is_break) {
        slotsByDay[s.day_of_week] = [...(slotsByDay[s.day_of_week] || []), s];
      }
    });
    [1, 2, 3, 4, 5].forEach((day: number) => {
      slotsByDay[day] = (slotsByDay[day] || []).sort((a: any, b: any) => a.period_number - b.period_number);
    });

    const subjectMap = new Map<number, any>(allSubjects?.map((s: any) => [s.id, s]));
    const toCreate: any[] = [];

    for (const cls of targetClasses || []) {
      const classSubjectList = allClassSubjects
        ?.filter((cs: any) => cs.class_id === cls.id)
        .sort((a: any, b: any) => b.weekly_hours - a.weekly_hours) || [];

      for (const cs of classSubjectList) {
        if (!cs.teacher_id) continue;
        const subject = subjectMap.get(cs.subject_id);
        const needed = cs.weekly_hours;
        let scheduled = 0;
        const maxSameSubjectPerDay = cs.weekly_hours >= 5 ? 2 : 1;
        const teacher = allTeachers?.find((t: any) => t.id === cs.teacher_id);
        const teacherMax = teacher?.max_hours_per_week || 30;

        const dayOrder = [1, 2, 3, 4, 5].sort(() => Math.random() - 0.5);

        for (let attempt = 0; attempt < 10 && scheduled < needed; attempt++) {
          for (const day of dayOrder) {
            if (scheduled >= needed) break;
            const daySlots = slotsByDay[day] || [];
            const classDay = `${cls.id}_${day}`;
            const subjectDay = `${cls.id}_${cs.subject_id}_${day}`;

            if ((classPerDay.get(classDay) || 0) >= 6) continue;
            if ((subjectPerDay.get(subjectDay) || 0) >= maxSameSubjectPerDay) continue;

            for (const slot of daySlots) {
              if (scheduled >= needed) break;
              const tk = `${cs.teacher_id}_${slot.id}`;
              const ck = `${cls.id}_${slot.id}`;
              if (teacherBusy.has(tk) || classBusy.has(ck)) continue;
              if (unavailSet.has(`${cs.teacher_id}_${day}_${slot.period_number}`)) continue;
              if ((teacherHoursCount[cs.teacher_id] || 0) >= teacherMax) continue;

              const availableRooms = allRooms?.filter((r: any) => !roomBusy.has(`${r.id}_${slot.id}`)) || [];
              const selectedRoom = availableRooms.find((r: any) => r.room_type === (subject?.required_room_type) && r.capacity >= (cls.total_students || 25)) 
                || availableRooms.find((r: any) => r.capacity >= (cls.total_students || 25))
                || availableRooms[0];

              if (!selectedRoom) continue;

              teacherBusy.add(tk);
              classBusy.add(ck);
              roomBusy.add(`${selectedRoom.id}_${slot.id}`);
              teacherHoursCount[cs.teacher_id]++;
              classPerDay.set(classDay, (classPerDay.get(classDay) || 0) + 1);
              subjectPerDay.set(subjectDay, (subjectPerDay.get(subjectDay) || 0) + 1);

              toCreate.push({
                class_id: cls.id,
                subject_id: cs.subject_id,
                teacher_id: cs.teacher_id,
                room_id: selectedRoom.id,
                time_slot_id: slot.id,
                week_type: "always",
                is_active: true
              });
              scheduled++;
            }
          }
        }
      }
    }

    if (toCreate.length > 0) {
      await supabase.from("schedule_entries").insert(toCreate);
    }

    return new Response(JSON.stringify({ success: true, count: toCreate.length }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
