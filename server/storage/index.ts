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

  // Core (Subjects, Rooms, Time Slots, Curriculum)
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

  getCurriculumPlans = this.core.getCurriculumPlans.bind(this.core);
  getActiveCurriculumPlan = this.core.getActiveCurriculumPlan.bind(this.core);
  createCurriculumPlan = this.core.createCurriculumPlan.bind(this.core);
  activateCurriculumPlan = this.core.activateCurriculumPlan.bind(this.core);
  getCurriculumEntries = this.core.getCurriculumEntries.bind(this.core);
  createCurriculumEntry = this.core.createCurriculumEntry.bind(this.core);
  updateCurriculumEntry = this.core.updateCurriculumEntry.bind(this.core);
  deleteCurriculumEntry = this.core.deleteCurriculumEntry.bind(this.core);

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
  getJointLessons = this.classes.getJointLessons.bind(this.classes);
  getJointLessonById = this.classes.getJointLessonById.bind(this.classes);
  createJointLesson = this.classes.createJointLesson.bind(this.classes);
  updateJointLesson = this.classes.updateJointLesson.bind(this.classes);
  deleteJointLesson = this.classes.deleteJointLesson.bind(this.classes);

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
