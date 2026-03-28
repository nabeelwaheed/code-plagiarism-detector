const db = require('../database/db');

class EnrollmentRepository {
	
    async getCoursesByUser(userId) {
        let sql = `
            SELECT c.*, e.role
            FROM public."Course" c
            JOIN public."Enrollment" e ON c.id = e.course_id
            WHERE e.user_id = $1 AND c.is_active = true`;
        let result = await db.query(sql, [userId]);
        return result.rows;
    }

    async enroll(courseId, userId, role) {
        let sql = `
            INSERT INTO public."Enrollment" (course_id, user_id, role) 
            VALUES ($1, $2, $3)
            ON CONFLICT (course_id, user_id) DO UPDATE SET role = $3`;
        await db.query(sql, [courseId, userId, role]);
    }
	
	async updateRole(courseId, userId, newRole) {
		let sql = `UPDATE "Enrollment" SET role = $1 WHERE course_id = $2 AND user_id = $3`;
		await db.query(sql, [newRole, courseId, userId]);
	}

	async remove(courseId, userId) {
        let sql = `DELETE FROM public."Enrollment" WHERE course_id = $1 AND user_id = $2`;
        await db.query(sql, [courseId, userId]);
    }
	
	async getEnrollmentRole(courseId, userId) {
		let sql = `
			SELECT role 
			FROM public."Enrollment" 
			WHERE course_id = $1 AND user_id = $2`;
		let result = await db.query(sql, [courseId, userId]);
        if (result.rows.length===0) {return null;} //Checks if not enrolled yet
		return result.rows[0].role;
	}

    async getAllUsersEnrolled(courseId) { //Added getAllUsersEnrolled
        let sql = `
            SELECT u.id, u.email, u.name, e.role
            FROM public."Enrollment" e
            JOIN public."User" u ON  e.user_id = u.id
            WHERE e.course_id = $1
            ORDER BY e.role ASC, u.email ASC;`;
        let result = await db.query(sql, [courseId]);
        return result.rows;
    }
}

module.exports = new EnrollmentRepository();