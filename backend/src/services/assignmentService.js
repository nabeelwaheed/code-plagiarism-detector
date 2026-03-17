const fs = require('fs-extra');
const path = require('path');
const assignmentRepository = require('../repositories/assignmentRepository');
const enrollmentRepository = require('../repositories/enrollmentRepository');

class AssignmentService {
	
    async saveFile(courseId, assignmentId, title, file) {
        if (path.extname(file.name).toLowerCase() !== '.zip') throw new Error("Only .zip allowed");		
        let safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        let dir = path.join('AssignmentRepository', courseId, assignmentId, "Assignment");
        await fs.ensureDir(dir);
        await file.mv(path.join(dir, `${safeTitle}.zip`));
    }

    async createAssignment(userId, courseId, data, file) {
        let role = await enrollmentRepository.getEnrollmentRole(courseId, userId);		
		let validRoles = ['instructor', 'admin', 'ta'];
        if (!validRoles.includes(role)) throw new Error("Unauthorized");		
        let assignment = await assignmentRepository.create(courseId, data.title, data.dueDate);
        await this.saveFile(courseId, assignment.id, data.title, file);
        return assignment;
    }

	async getAssignmentsByCourse(userId, courseId) {
		return await assignmentRepository.getAssignmentsByCourseId(courseId);
	}

    async editAssignmentFile(userId, courseId, assignmentId, newTitle, file) {
        let role = await enrollmentRepository.getEnrollmentRole(courseId, userId);
		let validRoles = ['instructor', 'admin', 'ta'];
        if (!validRoles.includes(role)) throw new Error("Unauthorized");
        await this.saveFile(courseId, assignmentId, newTitle, file);
    }
	
	async deleteAssignment(userId, courseId, assignmentId) {
		let role = await enrollmentRepository.getEnrollmentRole(courseId, userId);
		let validRoles = ['instructor', 'admin', 'ta'];
        if (!validRoles.includes(role)) throw new Error("Unauthorized");
		await assignmentRepository.delete(assignmentId);		
        let dir = path.join('AssignmentRepository', courseId, assignmentId, "Assignment");
		await fs.remove(dir);
	}

	async saveTemplateFile(courseId, assignmentId, version, file) {
        if (path.extname(file.name).toLowerCase() !== '.zip') throw new Error("Only .zip allowed");
        
        let dir = path.join('AssignmentRepository', courseId, assignmentId, 'template');
        await fs.ensureDir(dir);
        await file.mv(path.join(dir, `v${version}.zip`));
    }

    async uploadTemplate(userId, courseId, assignmentId, version, file) {
        let role = await enrollmentRepository.getEnrollmentRole(courseId, userId);
		let validRoles = ['instructor', 'admin', 'ta'];
        if (!validRoles.includes(role)) throw new Error("Unauthorized");
        await assignmentRepository.createTemplate(assignmentId, version);
        await this.saveTemplateFile(courseId, assignmentId, version, file);
    }
	
	getSubmissionPath(courseId, assignmentId, studentId) {
        return path.join('AssignmentRepository', courseId, assignmentId, 'Submissions', studentId);
    }

    async submitAssignment(studentId, courseId, assignmentId, metadata, file) {
        if (path.extname(file.name).toLowerCase() !== '.zip') throw new Error("Only .zip allowed");
        let dir = this.getSubmissionPath(courseId, assignmentId, studentId);
        await fs.ensureDir(dir);
        await file.mv(path.join(dir, `${studentId}.zip`));

        return await assignmentRepository.createSubmission(assignmentId, studentId, metadata);
    }

    async replaceSubmission(studentId, courseId, assignmentId, file) {
        let dir = this.getSubmissionPath(courseId, assignmentId, studentId);
        if (!(await fs.exists(dir))) throw new Error("No existing submission found to replace");
        await file.mv(path.join(dir, 'submission.zip'));
    }

    async deleteSubmission(studentId, courseId, assignmentId) {
        await assignmentRepository.deleteSubmission(assignmentId, studentId);
        let dir = this.getSubmissionPath(courseId, assignmentId, studentId);
        await fs.remove(dir);
    }
	
    async allAvailableSubmissions() { //Added function for services
        return await assignmentRepository.getAllSubmissions();
    }
    
    async allAvailableTemplates(assignmentId) { //Added function for services
        return await assignmentRepository.getTemplatesByAssignmentId(assignmentId);
    }
}

module.exports = new AssignmentService();