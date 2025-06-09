const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

class OfflineDatabase {
  constructor() {
    const dbPath = path.join(app.getPath('userData'), 'schedule.db');
    this.db = new Database(dbPath);
    this.initializeDatabase();
  }

  initializeDatabase() {
    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS access_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        owner_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'teacher',
        is_active BOOLEAN NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used DATETIME
      );

      CREATE TABLE IF NOT EXISTS schools (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT,
        phone TEXT,
        email TEXT,
        is_active BOOLEAN NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS subjects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        description TEXT,
        color TEXT NOT NULL DEFAULT '#1976D2',
        is_active BOOLEAN NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS teachers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        department TEXT,
        specialization TEXT,
        phone TEXT,
        max_hours_per_week INTEGER DEFAULT 40,
        preferences TEXT,
        unavailable_times TEXT,
        is_active BOOLEAN NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        grade TEXT NOT NULL,
        section TEXT,
        school_id INTEGER REFERENCES schools(id),
        class_teacher_id INTEGER REFERENCES teachers(id),
        total_students INTEGER DEFAULT 30,
        is_active BOOLEAN NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        room_number TEXT NOT NULL,
        building TEXT,
        floor TEXT,
        capacity INTEGER NOT NULL,
        room_type TEXT NOT NULL,
        equipment TEXT,
        is_active BOOLEAN NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS time_slots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        day_of_week INTEGER NOT NULL,
        is_break BOOLEAN NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS schedule_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id INTEGER REFERENCES classes(id) NOT NULL,
        subject_id INTEGER REFERENCES subjects(id) NOT NULL,
        teacher_id INTEGER REFERENCES teachers(id) NOT NULL,
        room_id INTEGER REFERENCES rooms(id) NOT NULL,
        time_slot_id INTEGER REFERENCES time_slots(id) NOT NULL,
        week_start_date DATE NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS schedule_conflicts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conflict_type TEXT NOT NULL,
        description TEXT NOT NULL,
        schedule_entry_1_id INTEGER REFERENCES schedule_entries(id),
        schedule_entry_2_id INTEGER REFERENCES schedule_entries(id),
        severity TEXT NOT NULL DEFAULT 'medium',
        is_resolved BOOLEAN NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert default data if tables are empty
    this.insertDefaultData();
  }

  insertDefaultData() {
    // Check if access codes exist
    const accessCodeCount = this.db.prepare('SELECT COUNT(*) as count FROM access_codes').get();
    if (accessCodeCount.count === 0) {
      const insertAccessCode = this.db.prepare(`
        INSERT INTO access_codes (code, owner_name, role) VALUES (?, ?, ?)
      `);
      
      insertAccessCode.run('ADMIN2024', 'Admin User', 'admin');
      insertAccessCode.run('TEACHER001', 'O\'qituvchi Birinchi', 'teacher');
      insertAccessCode.run('SCHOOL123', 'Maktab Mudiri', 'admin');
    }

    // Insert default school
    const schoolCount = this.db.prepare('SELECT COUNT(*) as count FROM schools').get();
    if (schoolCount.count === 0) {
      this.db.prepare(`
        INSERT INTO schools (name, address, phone, email) VALUES (?, ?, ?, ?)
      `).run('Toshkent Xalqaro Maktabi', 'Mirzo Ulugbek tumani, Toshkent', '+998 71 123-45-67', 'info@tis.uz');
    }

    // Insert default subjects
    const subjectCount = this.db.prepare('SELECT COUNT(*) as count FROM subjects').get();
    if (subjectCount.count === 0) {
      const insertSubject = this.db.prepare(`
        INSERT INTO subjects (name, code, description, color) VALUES (?, ?, ?, ?)
      `);
      
      insertSubject.run('Matematika', 'MATH', 'Algebra, Geometriya, Hisob', '#1976D2');
      insertSubject.run('O\'zbek tili', 'UZB', 'O\'zbek tili va adabiyoti', '#388E3C');
      insertSubject.run('Fizika', 'PHY', 'Mexanika, Termodinamika, Optika', '#F57C00');
      insertSubject.run('Kimyo', 'CHEM', 'Organik va noorganik kimyo', '#7B1FA2');
      insertSubject.run('Biologiya', 'BIO', 'Hujayra biologiyasi, Genetika', '#388E3C');
      insertSubject.run('Tarix', 'HIST', 'O\'zbekiston va jahon tarixi', '#5D4037');
      insertSubject.run('Ingliz tili', 'ENG', 'Ingliz tili va grammatika', '#1976D2');
      insertSubject.run('Jismoniy tarbiya', 'PE', 'Sport va sog\'lom turmush tarzi', '#E91E63');
    }

    // Insert default time slots
    const timeSlotCount = this.db.prepare('SELECT COUNT(*) as count FROM time_slots').get();
    if (timeSlotCount.count === 0) {
      const insertTimeSlot = this.db.prepare(`
        INSERT INTO time_slots (name, start_time, end_time, day_of_week) VALUES (?, ?, ?, ?)
      `);
      
      // Monday to Saturday, 6 periods per day
      const timeSlots = [
        '08:00-08:45', '08:50-09:35', '09:40-10:25', '10:45-11:30', '11:35-12:20', '12:25-13:10'
      ];
      
      for (let day = 1; day <= 6; day++) {
        timeSlots.forEach((slot, index) => {
          const [start, end] = slot.split('-');
          insertTimeSlot.run(`${index + 1}-dars`, start, end, day);
        });
      }
    }
  }

  // Database operation methods
  query(sql, params = []) {
    return this.db.prepare(sql).all(params);
  }

  get(sql, params = []) {
    return this.db.prepare(sql).get(params);
  }

  run(sql, params = []) {
    return this.db.prepare(sql).run(params);
  }

  close() {
    this.db.close();
  }

  // Backup methods
  backup(filePath) {
    return this.db.backup(filePath);
  }

  restore(filePath) {
    const backupDb = new Database(filePath);
    backupDb.backup(this.db);
    backupDb.close();
  }
}

module.exports = OfflineDatabase;