const courseService = require('../services/courseService');

class CourseController {
	
    create = async (req, res) => {
        let course = await courseService.createCourse(req.user.id, req.body);
        res.status(201).json(course);
    }

    updateStatus = async (req, res) => {
        await courseService.setCourseStatus(
            req.user.id, 
            req.params.id, 
            req.body.isActive
        );
        res.json({ message: "Course status updated" });
    }

    getAllCourses = async (req, res) => { //Added function
        let courses = await courseService.allAvailableCourses();
        res.status(200).json(courses);
    }
}

module.exports = new CourseController();