const userRepository = require('../repositories/userRepository');
const enrollmentService = require('../services/enrollmentService');

class EnrollmentController {
	
    getMyCourses = async (req, res) => {
        let courses = await enrollmentService.getMyCourses(req.user.id);
        res.json(courses);
    }

    enroll = async (req, res) => { //Refactored a bit
        let u_id = req.user.id;
        let c_id = req.params.courseId;
        let tu_email = req.body.email;
        let tu_id = await userRepository.getIdByEmail(tu_email);
        let role = req.body.role;
        await enrollmentService.enrollUser(
            u_id, 
            c_id, 
            tu_id.id, 
            role
        );
        res.json({ message: "User successfully enrolled" });
    }

    remove = async (req, res) => {
        await enrollmentService.deEnrollUser(
            req.user.id,
            req.params.courseId, 
            req.params.userId
        );
        res.json({ message: "User successfully removed from course" });
    }
}

module.exports = new EnrollmentController();