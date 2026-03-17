const userService = require('../services/userService');

class UserController {
    register = async (req, res) => {
        let user = await userService.register(req.body);
        res.status(201).json(user);
    }

    //Registered Instructor
    registerI = async (req, res) => {
        let user = await userService.registerInstructor(req.body);
        res.status(201).json(user);
    }

    login = async (req, res) => {
        let { email, password } = req.body;
        let user = await userService.login(email, password);       
        res.json({
            message: "Login successful",
            user
        });
    }

    promote = async (req, res) => {
        await userService.promoteUser(
            req.user.id, 
            req.params.id, 
            req.body.newRole
        );
        res.json({ message: `User promoted to ${req.body.newRole}` });
    }
	
	updatePassword = async (req, res) => {
		let { oldPassword, newPassword } = req.body;
		await userService.updatePassword(req.user.id, oldPassword, newPassword);
		res.json({ message: "Password updated successfully" });
	}
}

module.exports = new UserController();