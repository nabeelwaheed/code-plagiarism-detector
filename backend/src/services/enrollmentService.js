const enrollmentRepository = require('../repositories/enrollmentRepository');
const userRepository = require('../repositories/userRepository');

class EnrollmentService {
	
    async getMyCourses(userId) {
        return await enrollmentRepository.getCoursesByUser(userId);
    }

    async enrollUser(userId, courseId, targetUserId, role) {
        let user = await userRepository.getById(userId);
        let userRole = user.role; //Change here (works)
        let authorizedRoles = ['instructor', 'ta', 'admin'];
        if (!authorizedRoles.includes(userRole)) throw new Error("Unauthorized");
        let validRoles = ['instructor', 'ta', 'student'];
        if (!validRoles.includes(role)) throw new Error("Invalid role assigned");
        await enrollmentRepository.enroll(courseId, targetUserId, role);
    }

    async deEnrollUser(userId, courseId, targetUserId) {
        let user = await userRepository.getById(userId);
        let userRole = await enrollmentRepository.getEnrollmentRole(courseId, userId);
        let authorizedRoles = ['instructor', 'ta', 'admin'];
        if (!authorizedRoles.includes(userRole)) throw new Error("Unauthorized");
        await enrollmentRepository.remove(courseId, targetUserId);
    }
	
}

module.exports = new EnrollmentService();