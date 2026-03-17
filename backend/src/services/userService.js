const userRepository = require('../repositories/userRepository');
const bcrypt = require('bcrypt');

class UserService {
	
    async register(userData) {
        let passwordHash = await bcrypt.hash(userData.password, 10);
        return await userRepository.createStudent(userData.email, userData.name, passwordHash);
    }

    //Added in registration for instructors from the very start
    async registerInstructor(userData) {
        let passwordHash = await bcrypt.hash(userData.password, 10);
        return await userRepository.createInstructor(userData.email,userData.name,passwordHash);
    }
	
	async updatePassword(userId, oldPassword, newPassword) {
		let user = await userRepository.getById(userId);
		if (!user) throw new Error("user not found");
		let isMatch = await bcrypt.compare(oldPassword, user.password_hash);
		if (!isMatch) throw new Error("Incorrect password");
		let newHash = await bcrypt.hash(newPassword, 10);
		await userRepository.updatePassword(userId, newHash);
	}

    async promoteUser(adminId, targetUserId, newRole) {
        let admin = await userRepository.getById(adminId);        
        if (!admin || admin.role !== 'admin') throw new Error("You are not authorized to edit roles");
        let validRoles = ['instructor', 'admin', 'student'];
        if (!validRoles.includes(newRole)) throw new Error("Invalid role");
        return await userRepository.updateRole(targetUserId, newRole);
    }

	async login(email, plainPassword) {
        let user = await userRepository.getByEmail(email); 
        if (!user) throw new Error("Invalid email or password");
        let isMatch = await bcrypt.compare(plainPassword, user.password_hash);
        if (!isMatch) throw new Error("Invalid email or password");
        return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
        };
    }
	
}

module.exports = new UserService();