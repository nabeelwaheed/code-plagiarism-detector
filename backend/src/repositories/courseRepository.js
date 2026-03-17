const db = require('../database/db');

class CourseRepository {
	
    async create(courseCode, term) {
        let sql = `
            INSERT INTO public."Course" (id, course_code, term, is_active) 
            VALUES (gen_random_uuid(), $1, $2, true) 
            RETURNING *`;
        let result = await db.query(sql, [courseCode, term]);
        return result.rows[0];
    }

    async getById(id) {
        let sql = 'SELECT * FROM public."Course" WHERE id = $1';
        let result = await db.query(sql, [id]);
        return result.rows[0];
    }

    async toggleStatus(id, isActive) {
        let sql = `UPDATE public."Course" SET is_active = $1 WHERE id = $2`;
        await db.query(sql, [isActive, id]);
    }

    async getAllCourses() { //Added all course getter function
        let sql = `SELECT * FROM public."Course"`;
        let result = await db.query(sql);
        return result.rows;
    }
}

module.exports = new CourseRepository();