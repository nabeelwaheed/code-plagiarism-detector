const db = require('../database/db');

class AssignmentRepository {
	
    async create(courseId, title, dueDate) {
        let sql = `
            INSERT INTO public."Assignment" (id, course_id, title, due_date) 
            VALUES (gen_random_uuid(), $1, $2, $3) 
            RETURNING id, course_id, title, due_date, created_at`;
        let result = await db.query(sql, [courseId, title, dueDate]);
        return result.rows[0];
    }

    async getAssignmentsByCourseId(courseId) {
        let sql = `SELECT * FROM public."Assignment" WHERE course_id = $1`;
        let result = await db.query(sql, [courseId]);
        return result.rows;
    }

    async delete(id) {
        await db.query(`DELETE FROM public."Assignment" WHERE id = $1`, [id]);
    }

    async updateTitle(id, title) {
        await db.query(`UPDATE public."Assignment" SET title = $1 WHERE id = $2`, [title, id]);
    }

    async updateDueDate(id, dueDate) {
        await db.query(`UPDATE public."Assignment" SET due_date = $1 WHERE id = $2`, [dueDate, id]);
    }
	
	async createTemplate(assignmentId, version) {
        let sql = `
            INSERT INTO public."AssignmentTemplate" (id, assignment_id, version) 
            VALUES (gen_random_uuid(), $1, $2) 
            RETURNING id`;
        let result = await db.query(sql, [assignmentId, version]);
        return result.rows[0];
    }

    async getTemplateByAssignmentId(assignmentId,templateId) { //Added templateId to single out a template (multiple templates can exist)
        let sql = `SELECT * FROM public."AssignmentTemplate" WHERE assignment_id = $1 AND id = $2`;
        let result = await db.query(sql, [assignmentId, templateId]);
        return result.rows[0];
    }

    async getTemplatesByAssignmentId(assignmentId) { //Added all templates getter function
        let sql = `SELECT * FROM public."AssignmentTemplate" WHERE assignment_id = $1`;
        let result = await db.query(sql, [assignmentId]);
        return result.rows; //Edited from result.rows[0] to what you see now
    }
	
	async createSubmission(assignmentId, studentId, metadata) {
		let sql = `
			INSERT INTO public."Submission" (id, assignment_id, student_id, metadata) 
			VALUES (gen_random_uuid(), $1, $2, $3) 
			RETURNING id, assignment_id, student_id, submission_date, metadata`; 
		let result = await db.query(sql, [assignmentId, studentId, metadata]);
		return result.rows[0];
	}

    async getSubmission(assignmentId, studentId) {
        let sql = `SELECT * FROM public."Submission" WHERE assignment_id = $1 AND student_id = $2`;
        let result = await db.query(sql, [assignmentId, studentId]);
        return result.rows[0];
    }

    async getStudent(submissionId) { //Added get student from submission
        let sql = `SELECT student_id FROM public."Submission" WHERE id = $1`;
        let result = await db.query(sql, [submissionId]);
        return result.rows[0];
    }

    async getSubmissionById(assignmentId, submissionId) { //Added another way to get submissions (by id)
        let sql = `SELECT * FROM public."Submission" WHERE assignment_id = $1 AND id = $2`;
        let result = await db.query(sql, [assignmentId, submissionId]);
        return result.rows[0];
    }

    async deleteSubmission(assignmentId, studentId) {
        await db.query(`DELETE FROM public."Submission" WHERE assignment_id = $1 AND student_id = $2`, [assignmentId, studentId]);
    }

    async getAllSubmissions() { //Added all submission getter function
        let sql = `SELECT * FROM public."Submission"`;
        let result = await db.query(sql);
        return result.rows;
    }
}

module.exports = new AssignmentRepository();