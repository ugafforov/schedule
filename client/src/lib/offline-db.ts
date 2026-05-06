// Offline database adapter for Electron
declare global {
  interface Window {
    electronAPI?: {
      dbQuery: (sql: string, params?: any[]) => Promise<any[]>;
      dbGet: (sql: string, params?: any[]) => Promise<any>;
      dbRun: (sql: string, params?: any[]) => Promise<any>;
      getAppVersion: () => Promise<string>;
      exportData: () => Promise<{ success: boolean; path?: string; message?: string }>;
      importData: (filePath: string) => Promise<{ success: boolean; message?: string }>;
      selectFile: (filters?: any[]) => Promise<string>;
      saveFile: (defaultPath: string, filters?: any[]) => Promise<string>;
    };
  }
}

class OfflineDB {
  private isElectron: boolean;

  constructor() {
    this.isElectron = window.electronAPI !== undefined;
  }

  async query(sql: string, params: any[] = []): Promise<any[]> {
    if (this.isElectron && window.electronAPI) {
      return await window.electronAPI.dbQuery(sql, params);
    }
    throw new Error('Offline database not available');
  }

  async get(sql: string, params: any[] = []): Promise<any> {
    if (this.isElectron && window.electronAPI) {
      return await window.electronAPI.dbGet(sql, params);
    }
    throw new Error('Offline database not available');
  }

  async run(sql: string, params: any[] = []): Promise<any> {
    if (this.isElectron && window.electronAPI) {
      return await window.electronAPI.dbRun(sql, params);
    }
    throw new Error('Offline database not available');
  }

  // Authentication methods
  async authenticateAccessCode(code: string) {
    const accessCode = await this.get(
      'SELECT * FROM access_codes WHERE code = ? AND is_active = 1',
      [code]
    );

    if (!accessCode) {
      throw new Error('Noto\'g\'ri kirish kodi');
    }

    // Update last used timestamp
    await this.run(
      'UPDATE access_codes SET last_used = CURRENT_TIMESTAMP WHERE code = ?',
      [code]
    );

    return {
      id: accessCode.id,
      code: accessCode.code,
      ownerName: accessCode.owner_name,
      role: accessCode.role
    };
  }

  // Subject operations
  async getSubjects() {
    return await this.query('SELECT * FROM subjects WHERE is_active = 1 ORDER BY name');
  }

  async createSubject(data: { name: string; code: string; description?: string; color?: string }) {
    const result = await this.run(
      'INSERT INTO subjects (name, code, description, color) VALUES (?, ?, ?, ?)',
      [data.name, data.code, data.description || '', data.color || '#1976D2']
    );
    return await this.get('SELECT * FROM subjects WHERE id = ?', [result.lastInsertRowid]);
  }

  async updateSubject(id: number, data: Partial<{ name: string; code: string; description: string; color: string }>) {
    const setParts: string[] = [];
    const values = [];
    
    Object.entries(data).forEach(([key, value]) => {
      setParts.push(`${key} = ?`);
      values.push(value);
    });
    
    values.push(id);
    
    await this.run(
      `UPDATE subjects SET ${setParts.join(', ')} WHERE id = ?`,
      values
    );
    
    return await this.get('SELECT * FROM subjects WHERE id = ?', [id]);
  }

  async deleteSubject(id: number) {
    await this.run('UPDATE subjects SET is_active = 0 WHERE id = ?', [id]);
    return true;
  }

  // Teacher operations
  async getTeachers() {
    return await this.query('SELECT * FROM teachers WHERE is_active = 1 ORDER BY name');
  }

  async createTeacher(data: { 
    employeeId: string; 
    name: string; 
    department?: string; 
    specialization?: string; 
    phone?: string;
    maxHoursPerWeek?: number;
    unavailableTimes?: string[];
  }) {
    const result = await this.run(
      'INSERT INTO teachers (employee_id, name, department, specialization, phone, max_hours_per_week, unavailable_times) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        data.employeeId, 
        data.name, 
        data.department || '', 
        data.specialization || '', 
        data.phone || '', 
        data.maxHoursPerWeek || 40,
        JSON.stringify(data.unavailableTimes || [])
      ]
    );
    return await this.get('SELECT * FROM teachers WHERE id = ?', [result.lastInsertRowid]);
  }

  async updateTeacher(id: number, data: any) {
    const setParts: string[] = [];
    const values = [];
    
    Object.entries(data).forEach(([key, value]) => {
      if (key === 'employeeId') key = 'employee_id';
      if (key === 'maxHoursPerWeek') key = 'max_hours_per_week';
      if (key === 'unavailableTimes') value = JSON.stringify(value);
      
      setParts.push(`${key} = ?`);
      values.push(value);
    });
    
    values.push(id);
    
    await this.run(
      `UPDATE teachers SET ${setParts.join(', ')} WHERE id = ?`,
      values
    );
    
    return await this.get('SELECT * FROM teachers WHERE id = ?', [id]);
  }

  async deleteTeacher(id: number) {
    await this.run('UPDATE teachers SET is_active = 0 WHERE id = ?', [id]);
    return true;
  }

  // Room operations
  async getRooms() {
    return await this.query('SELECT * FROM rooms WHERE is_active = 1 ORDER BY name');
  }

  async createRoom(data: {
    name: string;
    roomNumber: string;
    building?: string;
    floor?: string;
    capacity: number;
    roomType: string;
    equipment?: string[];
  }) {
    const result = await this.run(
      'INSERT INTO rooms (name, room_number, building, floor, capacity, room_type, equipment) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        data.name,
        data.roomNumber,
        data.building || '',
        data.floor || '',
        data.capacity,
        data.roomType,
        JSON.stringify(data.equipment || [])
      ]
    );
    return await this.get('SELECT * FROM rooms WHERE id = ?', [result.lastInsertRowid]);
  }

  async updateRoom(id: number, data: any) {
    const setParts: string[] = [];
    const values = [];
    
    Object.entries(data).forEach(([key, value]) => {
      if (key === 'roomNumber') key = 'room_number';
      if (key === 'roomType') key = 'room_type';
      if (key === 'equipment') value = JSON.stringify(value);
      
      setParts.push(`${key} = ?`);
      values.push(value);
    });
    
    values.push(id);
    
    await this.run(
      `UPDATE rooms SET ${setParts.join(', ')} WHERE id = ?`,
      values
    );
    
    return await this.get('SELECT * FROM rooms WHERE id = ?', [id]);
  }

  async deleteRoom(id: number) {
    await this.run('UPDATE rooms SET is_active = 0 WHERE id = ?', [id]);
    return true;
  }

  // Class operations
  async getClasses() {
    return await this.query('SELECT * FROM classes WHERE is_active = 1 ORDER BY grade, name');
  }

  async createClass(data: {
    name: string;
    grade: string;
    section?: string;
    schoolId?: number;
    classTeacherId?: number;
    totalStudents?: number;
  }) {
    const result = await this.run(
      'INSERT INTO classes (name, grade, section, school_id, class_teacher_id, total_students) VALUES (?, ?, ?, ?, ?, ?)',
      [
        data.name,
        data.grade,
        data.section || '',
        data.schoolId || 1,
        data.classTeacherId || null,
        data.totalStudents || 30
      ]
    );
    return await this.get('SELECT * FROM classes WHERE id = ?', [result.lastInsertRowid]);
  }

  async updateClass(id: number, data: any) {
    const setParts: string[] = [];
    const values = [];
    
    Object.entries(data).forEach(([key, value]) => {
      if (key === 'schoolId') key = 'school_id';
      if (key === 'classTeacherId') key = 'class_teacher_id';
      if (key === 'totalStudents') key = 'total_students';
      
      setParts.push(`${key} = ?`);
      values.push(value);
    });
    
    values.push(id);
    
    await this.run(
      `UPDATE classes SET ${setParts.join(', ')} WHERE id = ?`,
      values
    );
    
    return await this.get('SELECT * FROM classes WHERE id = ?', [id]);
  }

  async deleteClass(id: number) {
    await this.run('UPDATE classes SET is_active = 0 WHERE id = ?', [id]);
    return true;
  }

  // Schedule operations
  async getScheduleEntries() {
    return await this.query(`
      SELECT 
        se.*,
        c.name as className,
        s.name as subjectName,
        s.color as subjectColor,
        t.name as teacherName,
        r.name as roomName,
        ts.name as timeSlotName,
        ts.start_time,
        ts.end_time,
        ts.day_of_week
      FROM schedule_entries se
      JOIN classes c ON se.class_id = c.id
      JOIN subjects s ON se.subject_id = s.id
      JOIN teachers t ON se.teacher_id = t.id
      JOIN rooms r ON se.room_id = r.id
      JOIN time_slots ts ON se.time_slot_id = ts.id
      WHERE se.is_active = 1
      ORDER BY ts.day_of_week, ts.start_time
    `);
  }

  async createScheduleEntry(data: {
    classId: number;
    subjectId: number;
    teacherId: number;
    roomId: number;
    timeSlotId: number;
    weekStartDate: string;
  }) {
    const result = await this.run(
      'INSERT INTO schedule_entries (class_id, subject_id, teacher_id, room_id, time_slot_id, week_start_date) VALUES (?, ?, ?, ?, ?, ?)',
      [data.classId, data.subjectId, data.teacherId, data.roomId, data.timeSlotId, data.weekStartDate]
    );
    return await this.get('SELECT * FROM schedule_entries WHERE id = ?', [result.lastInsertRowid]);
  }

  async deleteScheduleEntry(id: number) {
    await this.run('UPDATE schedule_entries SET is_active = 0 WHERE id = ?', [id]);
    return true;
  }

  // Time slot operations
  async getTimeSlots() {
    return await this.query('SELECT * FROM time_slots WHERE is_active = 1 ORDER BY day_of_week, start_time');
  }

  // Dashboard stats
  async getDashboardStats() {
    const stats = await this.query(`
      SELECT 
        (SELECT COUNT(*) FROM classes WHERE is_active = 1) as totalClasses,
        (SELECT COUNT(*) FROM teachers WHERE is_active = 1) as totalTeachers,
        (SELECT COUNT(*) FROM schedule_conflicts WHERE is_resolved = 0) as activeConflicts,
        (SELECT COUNT(*) FROM rooms WHERE is_active = 1) as totalRooms
    `);

    return {
      totalClasses: stats[0]?.totalClasses || 0,
      totalTeachers: stats[0]?.totalTeachers || 0,
      activeConflicts: stats[0]?.activeConflicts || 0,
      roomUtilization: 75 // Calculate based on actual usage
    };
  }

  // Auto-generate schedule
  async generateSchedule() {
    // Clear existing schedule
    await this.run('UPDATE schedule_entries SET is_active = 0');

    const classes = await this.getClasses();
    const subjects = await this.getSubjects();
    const teachers = await this.getTeachers();
    const rooms = await this.getRooms();
    const timeSlots = await this.getTimeSlots();

    const generatedEntries = [];

    for (const classItem of classes) {
      for (const subject of subjects.slice(0, 6)) { // Limit to 6 subjects per class
        const availableTeachers = teachers.filter(t => 
          t.specialization?.toLowerCase().includes(subject.name.toLowerCase()) ||
          t.department?.toLowerCase().includes(subject.name.toLowerCase())
        );
        
        const teacher = availableTeachers[0] || teachers[Math.floor(Math.random() * teachers.length)];
        const room = rooms[Math.floor(Math.random() * rooms.length)];
        
        // Find available time slot for this day
        const daySlots = timeSlots.filter(ts => ts.day_of_week <= 5); // Monday to Friday
        const timeSlot = daySlots[Math.floor(Math.random() * daySlots.length)];

        try {
          const entry = await this.createScheduleEntry({
            classId: classItem.id,
            subjectId: subject.id,
            teacherId: teacher.id,
            roomId: room.id,
            timeSlotId: timeSlot.id,
            weekStartDate: new Date().toISOString().split('T')[0]
          });
          generatedEntries.push(entry);
        } catch (error) {
          console.warn('Failed to create schedule entry:', error);
        }
      }
    }

    return generatedEntries;
  }

  // Bulk operations
  async bulkCreateSubjects(subjects: Array<{ name: string; code: string; description?: string; color?: string }>) {
    const results = [];
    for (const subject of subjects) {
      try {
        const result = await this.createSubject(subject);
        results.push(result);
      } catch (error) {
        console.warn(`Failed to create subject ${subject.name}:`, error);
      }
    }
    return results;
  }

  async bulkCreateTeachers(teachers: Array<any>) {
    const results = [];
    for (const teacher of teachers) {
      try {
        const result = await this.createTeacher(teacher);
        results.push(result);
      } catch (error) {
        console.warn(`Failed to create teacher ${teacher.name}:`, error);
      }
    }
    return results;
  }

  async bulkCreateRooms(rooms: Array<any>) {
    const results = [];
    for (const room of rooms) {
      try {
        const result = await this.createRoom(room);
        results.push(result);
      } catch (error) {
        console.warn(`Failed to create room ${room.name}:`, error);
      }
    }
    return results;
  }

  async bulkCreateClasses(classes: Array<any>) {
    const results = [];
    for (const classItem of classes) {
      try {
        const result = await this.createClass(classItem);
        results.push(result);
      } catch (error) {
        console.warn(`Failed to create class ${classItem.name}:`, error);
      }
    }
    return results;
  }
}

export const offlineDB = new OfflineDB();