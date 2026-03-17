const courseRepository = require('../repositories/courseRepository');
const userRepository = require('../repositories/userRepository');

class CourseService {
	
    async createCourse(userId, courseData) {
		let user = await userRepository.getById(userId)
        let role = user.role;
        let validRoles = ['instructor', 'admin'];
        if (!validRoles.includes(role)) throw new Error("Unauthorized");
        return await courseRepository.create(courseData.course_code, courseData.term); //Change here
    }

    async setCourseStatus(userId, courseId, isActive) {
		let user = await userRepository.getById(userId)
        let role = user.role;
        let validRoles = ['instructor', 'admin'];
		if (!validRoles.includes(role)) throw new Error("Unauthorized");
        await courseRepository.toggleStatus(courseId, isActive);
    }

    async allAvailableCourses() { //Added function for services
        return await courseRepository.getAllCourses();
    }
}

module.exports = new CourseService();