const db = require('../database/db');

class UserRepository {
	
    async createStudent(email, name, passwordHash) {
        let sql = `
            INSERT INTO public."User" (id, email, name, password_hash, role) 
            VALUES (gen_random_uuid(), $1, $2, $3, 'student') 
            RETURNING id, email, role`;
        let result = await db.query(sql, [email, name, passwordHash]);
        return result.rows[0];
    }

    //Added createInstructor to automatically register as instructor from the start
    async createInstructor(email, name, passwordHash) {
        let sql =  `
            INSERT INTO public."User" (id, email, name, password_hash, role)
            VALUES (gen_random_uuid(), $1, $2, $3, 'instructor')
            RETURNING id, email, role`;
        let result = await db.query(sql, [email, name, passwordHash]);
        return result.rows[0];
    }

    async updateRole(userId, role) {
        let sql = `UPDATE public."User" SET role = $1 WHERE id = $2`;
        await db.query(sql, [role, userId]);
    }

	async updatePassword(userId, passwordHash) {
        let sql = `UPDATE public."User" SET password_hash = $1 WHERE id = $2`;
        await db.query(sql, [passwordHash, userId]);
    }
	
    async getById(id) {
		let sql = 'SELECT * FROM public."User" WHERE id = $1';
        let result = await db.query(sql, [id]);
        return result.rows[0];
    }
	
	async getByEmail(email) {
        let sql = 'SELECT * FROM public."User" WHERE email = $1';
        let result = await db.query(sql, [email]);
        return result.rows[0];
    }

    async getIdByEmail(email) { //Added getter function for email using id
        let sql = 'SELECT id FROM public."User" WHERE email = $1';
        let result = await db.query(sql, [email]);
        return result.rows[0];
    }

    async getRoleByEmail(role) { //Added getter function for role using email
        let sql = 'SELECT role FROM public."User" WHERE email = $1';
        let result = await db.query(sql, [role]);
        return result.rows[0];
    }
}

module.exports = new UserRepository();