import { IStorage } from "./IStorage";
import { CoreStorage } from "./core.storage";
import { TeacherStorage } from "./teachers.storage";
import { ClassStorage } from "./classes.storage";
import { ScheduleStorage } from "./schedule.storage";

class DatabaseStorage implements IStorage {
  private core = new CoreStorage();
  private teachers = new TeacherStorage();
  private classes = new ClassStorage();
  private schedule = new ScheduleStorage();

  // Core (Access Codes, Subjects, Rooms, Time Slots)
  getAccessCodeByCode = this.core.getAccessCodeByCode.bind(this.core);
  createAccessCode = this.core.createAccessCode.bind(this.core);
  updateAccessCodeLastUsed = this.core.updateAccessCodeLastUsed.bind(this.core);
  getAllAccessCodes = this.core.getAllAccessCodes.bind(this.core);
  deleteAccessCode = this.core.deleteAccessCode.bind(this.core);

  getSubjects = this.core.getSubjects.bind(this.core);
  createSubject = this.core.createSubject.bind(this.core);
  updateSubject = this.core.updateSubject.bind(this.core);
  deleteSubject = this.core.deleteSubject.bind(this.core);

  getRooms = this.core.getRooms.bind(this.core);
  createRoom = this.core.createRoom.bind(this.core);
  updateRoom = this.core.updateRoom.bind(this.core);
  deleteRoom = this.core.deleteRoom.bind(this.core);

  getTimeSlots = this.core.getTimeSlots.bind(this.core);
  createTimeSlot = this.core.createTimeSlot.bind(this.core);
  updateTimeSlot = this.core.updateTimeSlot.bind(this.core);
  deleteTimeSlot = this.core.deleteTimeSlot.bind(this.core);
  deleteAllTimeSlots = this.core.deleteAllTimeSlots.bind(this.core);

  // Teachers
  getTeachers = this.teachers.getTeachers.bind(this.teachers);
  createTeacher = this.teachers.createTeacher.bind(this.teachers);
  updateTeacher = this.teachers.updateTeacher.bind(this.teachers);
  deleteTeacher = this.teachers.deleteTeacher.bind(this.teachers);
  getTeacherSubjects = this.teachers.getTeacherSubjects.bind(this.teachers);
  setTeacherSubjects = this.teachers.setTeacherSubjects.bind(this.teachers);
  getTeacherUnavailability = this.teachers.getTeacherUnavailability.bind(this.teachers);
  getAllTeacherUnavailability = this.teachers.getAllTeacherUnavailability.bind(this.teachers);
  setTeacherUnavailability = this.teachers.setTeacherUnavailability.bind(this.teachers);

  // Classes
  getClasses = this.classes.getClasses.bind(this.classes);
  createClass = this.classes.createClass.bind(this.classes);
  updateClass = this.classes.updateClass.bind(this.classes);
  deleteClass = this.classes.deleteClass.bind(this.classes);
  getClassSubjects = this.classes.getClassSubjects.bind(this.classes);
  getAllClassSubjects = this.classes.getAllClassSubjects.bind(this.classes);
  setClassSubjects = this.classes.setClassSubjects.bind(this.classes);

  // Schedule
  getScheduleEntries = this.schedule.getScheduleEntries.bind(this.schedule);
  getScheduleEntriesByClass = this.schedule.getScheduleEntriesByClass.bind(this.schedule);
  getScheduleEntriesByTeacher = this.schedule.getScheduleEntriesByTeacher.bind(this.schedule);
  createScheduleEntry = this.schedule.createScheduleEntry.bind(this.schedule);
  createScheduleEntriesBulk = this.schedule.createScheduleEntriesBulk.bind(this.schedule);
  updateScheduleEntry = this.schedule.updateScheduleEntry.bind(this.schedule);
  deleteScheduleEntry = this.schedule.deleteScheduleEntry.bind(this.schedule);
  deleteAllScheduleEntries = this.schedule.deleteAllScheduleEntries.bind(this.schedule);
  clearScheduleForClass = this.schedule.clearScheduleForClass.bind(this.schedule);

  // Conflicts
  getUnresolvedConflicts = this.schedule.getUnresolvedConflicts.bind(this.schedule);
  createConflict = this.schedule.createConflict.bind(this.schedule);
  resolveConflict = this.schedule.resolveConflict.bind(this.schedule);
  clearConflicts = this.schedule.clearConflicts.bind(this.schedule);

  // Dashboard
  getDashboardStats = this.schedule.getDashboardStats.bind(this.schedule);
}

export const storage = new DatabaseStorage();
